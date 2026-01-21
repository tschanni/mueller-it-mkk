import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Problem mit Login', description: 'Titel des Tickets' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  title: string;

  @ApiProperty({ example: 'Ich kann mich nicht einloggen...', description: 'Erste Nachricht' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  initialMessage: string;
}
