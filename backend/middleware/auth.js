import admin from '../config/firebase.js';
import { User } from '../models/User.js';

/**
 * Express middleware — verifies a Firebase ID token passed as
 *   Authorization: Bearer <idToken>
 * On success attaches MongoDB User to req.user.
 */
export async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Auto-create or fetch user from DB
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email.split('@')[0]
      });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Firebase token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
}
