import {
  Controller, Get, Patch, Body, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';\nimport { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UsersService } from './users.service';

class UpdateLocationDto {
  @IsNumber()
  @Min(-90) @Max(90)
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Min(-180) @Max(180)
  @Type(() => Number)
  lng: number;
}

class UpdateFcmTokenDto {
  @IsString()
  token: string;
}

class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;
}

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  /** GET /api/users/me */
  @Get('me')
  getMe(@Request() req) {
    return this.svc.findById(req.user.id);
  }

  /** GET /api/users/stats — returns cases reported + sightings uploaded counts */
  @Get('stats')
  getStats(@Request() req) {
    return this.svc.getStats(req.user.id);
  }

  /** PATCH /api/users/location */
  @Patch('location')
  async updateLocation(@Request() req, @Body() dto: UpdateLocationDto) {
    await this.svc.updateLocation(req.user.id, dto.lat, dto.lng);
    return { success: true };
  }

  /** PATCH /api/users/fcm-token */
  @Patch('fcm-token')
  async updateFcmToken(@Request() req, @Body() dto: UpdateFcmTokenDto) {
    await this.svc.updateFcmToken(req.user.id, dto.token);
    return { success: true };
  }

  /** PATCH /api/users/profile — update name and other profile fields */
  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.svc.updateProfile(req.user.id, dto);
  }
}
