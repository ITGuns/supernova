import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginDto } from './dto/login.dto';

export interface DemoUser {
  id: string;
  email: string;
  pin: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'manager' | 'cashier' | 'server' | 'kitchen';
}

// Seeded users for the mock stage (swapped for the DB-backed User table in the hardening pass).
const USERS: DemoUser[] = [
  { id: 'u-owner', email: 'owner@nova.local', pin: '1234', firstName: 'Sam', lastName: 'Rivera', role: 'owner' },
  { id: 'u-alex', email: 'alex@nova.local', pin: '4321', firstName: 'Alex', lastName: 'Kim', role: 'cashier' },
];

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';

export interface AuthResult {
  user: Omit<DemoUser, 'pin'>;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  login(dto: LoginDto): AuthResult {
    const user = USERS.find(
      (u) => (dto.email && u.email === dto.email) || (dto.pin && u.pin === dto.pin),
    );
    // Mock stage: password is not enforced. Real credential checks land in the hardening pass.
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user);
  }

  me(userId: string): Omit<DemoUser, 'pin'> {
    const user = USERS.find((u) => u.id === userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.strip(user);
  }

  private issue(user: DemoUser): AuthResult {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign(
      { sub: user.id },
      { secret: REFRESH_SECRET, expiresIn: '30d' },
    );
    return { user: this.strip(user), accessToken, refreshToken };
  }

  private strip(user: DemoUser): Omit<DemoUser, 'pin'> {
    const { pin: _pin, ...rest } = user;
    return rest;
  }
}
