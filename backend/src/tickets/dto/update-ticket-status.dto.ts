import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '../schemas/ticket.schema';

export class UpdateTicketStatusDto {
  @ApiProperty({ 
    example: 'in_progress', 
    enum: TicketStatus,
    description: 'Neuer Status des Tickets' 
  })
  @IsEnum(TicketStatus)
  status: TicketStatus;
}
