import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Neues Ticket erstellen' })
  @ApiResponse({ status: 201, description: 'Ticket erfolgreich erstellt' })
  @ApiResponse({ status: 401, description: 'Nicht authentifiziert' })
  async createTicket(
    @CurrentUser() user: any,
    @Body() createTicketDto: CreateTicketDto,
  ) {
    return this.ticketsService.createTicket(user.userId, createTicketDto);
  }

  @Get()
  @ApiOperation({ summary: 'Alle eigenen Tickets abrufen' })
  @ApiResponse({ status: 200, description: 'Liste der Tickets' })
  async getUserTickets(@CurrentUser() user: any) {
    return this.ticketsService.getUserTickets(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ticket-Details mit Nachrichten abrufen' })
  @ApiResponse({ status: 200, description: 'Ticket-Details' })
  @ApiResponse({ status: 404, description: 'Ticket nicht gefunden' })
  async getTicket(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketsService.getTicketById(id, user.userId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Nachricht zu Ticket hinzufügen' })
  @ApiResponse({ status: 201, description: 'Nachricht gesendet' })
  async addMessage(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.ticketsService.addMessage(id, user.userId, createMessageDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ticket-Status ändern' })
  @ApiResponse({ status: 200, description: 'Status aktualisiert' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateStatusDto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(id, user.userId, updateStatusDto);
  }
}
