import { auth, db } from '../firebase';
import { collection, query, getDocs, where, getDoc, doc } from 'firebase/firestore';
import { Student, UserProfile } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('permission-denied')) {
    console.warn('Permission denied, ignoring...');
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function fetchStudentsForUser(): Promise<Student[]> {
  const user = auth.currentUser;
  if (!user) return [];
  
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) return [];
    
    const profile = userDoc.data() as UserProfile;
    if (!profile.isApproved && profile.role !== 'admin') return [];
    
    let q;
    if (profile.role === 'admin') {
      q = query(collection(db, 'students'));
    } else if (profile.role === 'teacher') {
      q = query(collection(db, 'students'), where('teacherId', '==', user.uid));
    } else {
      // Students shouldn't fetch all students, but if they need to, maybe just themselves
      if (profile.studentId) {
        q = query(collection(db, 'students'), where('studentId', '==', profile.studentId));
      } else {
        return [];
      }
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Student));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
    return [];
  }
}
