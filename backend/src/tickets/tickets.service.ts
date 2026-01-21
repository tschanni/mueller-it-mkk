import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from './schemas/ticket.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createTicket(userId: string, createTicketDto: CreateTicketDto) {
    // Create ticket
    const ticket = new this.ticketModel({
      userId,
      title: createTicketDto.title,
      lastMessageAt: new Date(),
    });

    await ticket.save();

    // Create initial message
    const message = new this.messageModel({
      ticketId: ticket._id,
      senderId: userId,
      content: createTicketDto.initialMessage,
      isAdminMessage: false,
    });

    await message.save();

    return this.getTicketById(ticket._id.toString(), userId);
  }

  async getUserTickets(userId: string) {
    const tickets = await this.ticketModel
      .find({ userId })
      .sort({ lastMessageAt: -1 })
      .lean();

    const ticketsWithCount = await Promise.all(
      tickets.map(async (ticket) => {
        const messageCount = await this.messageModel.countDocuments({
          ticketId: ticket._id,
        });

        return {
          id: ticket._id,
          title: ticket.title,
          status: ticket.status,
          createdAt: ticket.createdAt,
          lastMessageAt: ticket.lastMessageAt,
          messageCount,
        };
      }),
    );

    return ticketsWithCount;
  }

  async getTicketById(ticketId: string, userId: string) {
    const ticket = await this.ticketModel.findById(ticketId).lean();

    if (!ticket) {
      throw new NotFoundException('Ticket nicht gefunden');
    }

    if (ticket.userId.toString() !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Ticket');
    }

    const messages = await this.messageModel
      .find({ ticketId })
      .populate('senderId', 'username role')
      .sort({ createdAt: 1 })
      .lean();

    return {
      ...ticket,
      id: ticket._id,
      messages,
    };
  }

  async addMessage(ticketId: string, userId: string, createMessageDto: CreateMessageDto, isAdmin = false) {
    const ticket = await this.ticketModel.findById(ticketId);

    if (!ticket) {
      throw new NotFoundException('Ticket nicht gefunden');
    }

    if (!isAdmin && ticket.userId.toString() !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Ticket');
    }

    const message = new this.messageModel({
      ticketId,
      senderId: userId,
      content: createMessageDto.content,
      isAdminMessage: isAdmin,
    });

    await message.save();

    // Update ticket last message time
    ticket.lastMessageAt = new Date();
    await ticket.save();

    return message;
  }

  async updateTicketStatus(ticketId: string, userId: string, updateStatusDto: UpdateTicketStatusDto, isAdmin = false) {
    const ticket = await this.ticketModel.findById(ticketId);

    if (!ticket) {
      throw new NotFoundException('Ticket nicht gefunden');
    }

    if (!isAdmin && ticket.userId.toString() !== userId) {
      throw new ForbiddenException('Kein Zugriff auf dieses Ticket');
    }

    ticket.status = updateStatusDto.status;
    await ticket.save();

    return ticket;
  }

  async getAllTickets() {
    const tickets = await this.ticketModel
      .find()
      .populate('userId', 'username email firmenname')
      .sort({ lastMessageAt: -1 })
      .lean();

    const ticketsWithCount = await Promise.all(
      tickets.map(async (ticket) => {
        const messageCount = await this.messageModel.countDocuments({
          ticketId: ticket._id,
        });

        return {
          ...ticket,
          id: ticket._id,
          messageCount,
        };
      }),
    );

    return ticketsWithCount;
  }

  async getTicketByIdAdmin(ticketId: string) {
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('userId', 'username email firmenname')
      .lean();

    if (!ticket) {
      throw new NotFoundException('Ticket nicht gefunden');
    }

    const messages = await this.messageModel
      .find({ ticketId })
      .populate('senderId', 'username role')
      .sort({ createdAt: 1 })
      .lean();

    return {
      ...ticket,
      id: ticket._id,
      messages,
    };
  }
}
