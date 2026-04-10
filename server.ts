import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

// Initialize Firebase Admin with Application Default Credentials
try {
  admin.initializeApp();
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Logging middleware - Move to top to catch all requests
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      // Skip logging for common static assets and source files to reduce noise if successful
      const isAsset = /\.(js|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/.test(req.url);
      if (isAsset && res.statusCode < 400) return;

      const duration = Date.now() - start;
      console.log(`[ACCESS] ${new Date().toISOString()} - ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/test', (req, res) => {
    console.log('Test route requested');
    res.json({ message: 'Express is working' });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
  );

  const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

  // Helper to get authenticated calendar client
  const getCalendarClient = (tokens: any) => {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);
    return google.calendar({ version: 'v3', auth });
  };

  // Auth Routes
  app.get('/api/auth/google/url', (req, res) => {
    console.log('Auth URL requested');
    try {
      if (!process.env.GOOGLE_CLIENT_ID) {
        console.error('GOOGLE_CLIENT_ID is missing');
        return res.status(400).json({ error: 'GOOGLE_CLIENT_ID is not configured' });
      }
      const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });
      console.log('Generated URL:', url);
      res.json({ url });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      // In a real app, you'd store these tokens in Firestore linked to the user
      // For this demo, we'll send them back to the client via postMessage
      // and let the client handle storage (though server-side storage is safer)
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'GOOGLE_AUTH_SUCCESS', 
                  tokens: ${JSON.stringify(tokens)} 
                }, '*');
                window.close();
              } else {
                window.location.href = '/calendar';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Calendar Management Routes
  app.post('/api/calendar/events/sync', async (req, res) => {
    const { tokens } = req.body;
    if (!tokens) return res.status(401).json({ error: 'No tokens provided' });

    try {
      const calendar = getCalendarClient(tokens);
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });
      res.json(response.data.items || []);
    } catch (error: any) {
      console.error('Error fetching Google events:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to fetch events';
      res.status(error.code || 500).json({ error: errorMessage });
    }
  });

  app.post('/api/calendar/events', async (req, res) => {
    const { tokens, event } = req.body;
    try {
      const calendar = getCalendarClient(tokens);
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          start: event.allDay ? { date: event.start.split('T')[0] } : { dateTime: event.start },
          end: event.allDay ? { date: event.end ? event.end.split('T')[0] : event.start.split('T')[0] } : { dateTime: event.end || event.start },
        },
      });
      res.json(response.data);
    } catch (error) {
      console.error('Error creating Google event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.put('/api/calendar/events/:id', async (req, res) => {
    const { tokens, event } = req.body;
    const { id } = req.params;
    try {
      const calendar = getCalendarClient(tokens);
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: id,
        requestBody: {
          summary: event.title,
          description: event.description,
          start: event.allDay ? { date: event.start.split('T')[0] } : { dateTime: event.start },
          end: event.allDay ? { date: event.end ? event.end.split('T')[0] : event.start.split('T')[0] } : { dateTime: event.end || event.start },
        },
      });
      res.json(response.data);
    } catch (error) {
      console.error('Error updating Google event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  app.delete('/api/calendar/events/:id', async (req, res) => {
    const { tokens } = req.body;
    const { id } = req.params;
    try {
      const calendar = getCalendarClient(tokens);
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: id,
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting Google event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  // Real-time Thai Holidays API
  app.get('/api/holidays/:year', async (req, res) => {
    const { year } = req.params;
    try {
      console.log(`Fetching holidays for year: ${year}`);
      // Fetch from a public holiday API (Nager.Date is free and reliable)
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/TH`);
      
      if (!response.ok) {
        console.warn(`External holiday API returned ${response.status}. Falling back to empty list.`);
        return res.json([]);
      }

      const text = await response.text();
      if (!text) {
        console.warn('Empty response from holiday API. Falling back to empty list.');
        return res.json([]);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Invalid JSON from holiday API. Falling back to empty list.');
        return res.json([]);
      }
      
      if (!Array.isArray(data)) {
        console.warn('Holiday API did not return an array. Falling back to empty list.');
        return res.json([]);
      }

      // Map to our Holiday interface
      const holidays = data.map((h: any) => ({
        date: h.date,
        name: h.localName || h.name,
        isPublicHoliday: true
      }));

      res.json(holidays);
    } catch (error: any) {
      console.error('Error fetching real-time holidays:', error.message);
      // Return empty array so frontend can use its local fallback without error
      res.json([]);
    }
  });

  // Firebase Admin Routes
  app.delete('/api/users/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
      await admin.auth().deleteUser(uid);
      console.log(`Successfully deleted user ${uid} from Firebase Auth`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting user from Firebase Auth:', error);
      res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('*all', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        // 1. Read index.html
        let template = await fs.readFile(
          path.resolve(__dirname, 'index.html'),
          'utf-8'
        );

        // 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
        //    also applies HTML transforms from Vite plugins, e.g. global preambles
        //    from @vitejs/plugin-react
        template = await vite.transformIndexHtml(url, template);

        // 3. Send the rendered HTML back.
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        // If an error is caught, let Vite fix the stack trace so it maps back to
        // your actual source code.
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('CRITICAL: Failed to start server:', err);
});
