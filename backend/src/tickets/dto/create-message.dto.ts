import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'Danke für die Rückmeldung!', description: 'Nachrichteninhalt' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;
}
