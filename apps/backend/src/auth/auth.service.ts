import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as admin from 'firebase-admin';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.initFirebase();
  }

  private initFirebase() {
    if (admin.apps.length > 0) return;
    const raw = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — auth disabled in dev mode.');
      return;
    }
    const serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    this.logger.log('Firebase Admin initialised.');
  }

  /**
   * Verify the Firebase ID token sent by the mobile app after OTP login.
   * Returns a JWT for subsequent requests.
   */
  async verifyFirebaseToken(idToken: string) {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      this.logger.warn(`Firebase token verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired Firebase token.');
    }

    const phone = decoded.phone_number;
    if (!phone) {
      throw new UnauthorizedException('Phone number not found in Firebase token.');
    }

    // Upsert user
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({ phone, role: UserRole.CITIZEN });
    }

    const payload = { sub: user.id, phone: user.phone, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user };
  }
}
