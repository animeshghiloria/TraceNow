import {
  Controller, Post, Get, Param, Body, Query, UseGuards,
  Request, UseInterceptors, UploadedFile, ParseFloatPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { SightingsService } from './sightings.service';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class CreateSightingBodyDto {
  @IsString() caseId: string;
  @IsNumber() @Type(() => Number) lat: number;
  @IsNumber() @Type(() => Number) lng: number;
  @IsOptional() @IsString() notes?: string;
}

@Controller('sightings')
@UseGuards(AuthGuard('jwt'))
export class SightingsController {
  constructor(private readonly svc: SightingsService) {}

  /** POST /api/sightings — multipart */
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Request() req,
    @Body() dto: CreateSightingBodyDto,
    @UploadedFile() file?,
  ) {
    return this.svc.create(
      dto.caseId,
      req.user.id,
      dto.lat,
      dto.lng,
      dto.notes,
      file?.buffer,
      file?.mimetype,
    );
  }

  /** GET /api/sightings/case/:caseId */
  @Get('case/:caseId')
  getByCaseId(@Param('caseId') caseId: string) {
    return this.svc.findByCaseId(caseId);
  }
}
