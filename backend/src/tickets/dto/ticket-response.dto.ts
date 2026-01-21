import { ApiProperty } from '@nestjs/swagger';

export class TicketResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  id: string;

  @ApiProperty({ example: 'Problem mit Login' })
  title: string;

  @ApiProperty({ example: 'open' })
  status: string;

  @ApiProperty({ example: '2026-01-21T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-21T14:30:00.000Z' })
  lastMessageAt?: Date;

  @ApiProperty({ example: 5 })
  messageCount: number;
}
