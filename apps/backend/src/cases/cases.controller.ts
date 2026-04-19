import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request, UseInterceptors, UploadedFile,
  ParseFloatPipe, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { CasesService, CreateCaseDto } from './cases.service';
import { CaseStatus } from './case.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../users/user.entity';
import {
  IsString, IsNumber, IsOptional, IsDateString, Min, Max, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateCaseBodyDto implements CreateCaseDto {
  @IsString() childName: string;
  @IsNumber() @Min(0) @Max(18) @Type(() => Number) childAge: number;
  @IsOptional() @IsString() description?: string;
  @IsDateString() lastSeenAt: string;
  @IsNumber() @Type(() => Number) lat: number;
  @IsNumber() @Type(() => Number) lng: number;
  @IsOptional() @IsString() lastSeenAddr?: string;
  @IsOptional() @IsNumber() @Type(() => Number) alertRadiusKm?: number;
}

class UpdateStatusDto {
  @IsEnum(CaseStatus) status: CaseStatus;
}

@Controller('cases')
@UseGuards(AuthGuard('jwt'))
export class CasesController {
  constructor(private readonly svc: CasesService) {}

  /** POST /api/cases — multipart: image + JSON fields */
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Request() req,
    @Body() dto: CreateCaseBodyDto,
    @UploadedFile() file?,
  ) {
    return this.svc.create(
      req.user.id,
      dto,
      file?.buffer,
      file?.mimetype,
    );
  }

  /** GET /api/cases?status=open&limit=20&offset=0&q=name */
  @Get()
  findAll(
    @Query('status') status?: CaseStatus,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
    @Query('q') q?: string,
  ) {
    return this.svc.findAll(status, limit, offset, q);
  }

  /** GET /api/cases/nearby?lat=x&lng=y&radius=10 */
  @Get('nearby')
  findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', new DefaultValuePipe(20), ParseFloatPipe) radius = 20,
  ) {
    return this.svc.findNearbyCases(lat, lng, radius);
  }

  /** GET /api/cases/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  /** PATCH /api/cases/:id/status — authority or admin only */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AUTHORITY, UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.svc.updateStatus(id, dto.status);
  }
}
