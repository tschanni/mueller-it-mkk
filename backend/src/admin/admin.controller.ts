import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from '../tickets/tickets.service';
import { CreateMessageDto } from '../tickets/dto/create-message.dto';
import { UpdateTicketStatusDto } from '../tickets/dto/update-ticket-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'Alle Tickets abrufen (Admin)' })
  @ApiResponse({ status: 200, description: 'Liste aller Tickets' })
  @ApiResponse({ status: 403, description: 'Keine Berechtigung' })
  async getAllTickets() {
    return this.ticketsService.getAllTickets();
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Ticket-Details abrufen (Admin)' })
  @ApiResponse({ status: 200, description: 'Ticket-Details' })
  @ApiResponse({ status: 404, description: 'Ticket nicht gefunden' })
  async getTicket(@Param('id') id: string) {
    return this.ticketsService.getTicketByIdAdmin(id);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Admin-Antwort zu Ticket hinzufügen' })
  @ApiResponse({ status: 201, description: 'Nachricht gesendet' })
  async replyToTicket(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.ticketsService.addMessage(id, user.userId, createMessageDto, true);
  }

  @Patch('tickets/:id/status')
  @ApiOperation({ summary: 'Ticket-Status ändern (Admin)' })
  @ApiResponse({ status: 200, description: 'Status aktualisiert' })
  async updateTicketStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateStatusDto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(id, user.userId, updateStatusDto, true);
  }
}
