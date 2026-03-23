import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Store connected users: userId -> socketId
  private connectedUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      console.log(`WS Connected: ${client.id} (User: ${userId})`);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        console.log(`WS Disconnected: ${client.id} (User: ${userId})`);
        break;
      }
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { toUserId: string; itemId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const targetSocketId = this.connectedUsers.get(data.toUserId.toString());
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('typing', {
        fromUserId: this.getUserIdBySocketId(client.id),
        itemId: data.itemId,
      });
    }
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @MessageBody() data: { toUserId: string; itemId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const targetSocketId = this.connectedUsers.get(data.toUserId.toString());
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('stopTyping', {
        fromUserId: this.getUserIdBySocketId(client.id),
        itemId: data.itemId,
      });
    }
  }

  // Notifies the recipient when a new message is saved
  notifyNewMessage(toUserId: string, messagePayload: any) {
    const targetSocketId = this.connectedUsers.get(toUserId.toString());
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('newMessage', messagePayload);
    }
  }

  // Notifies the recipient that a single message was deleted (soft-delete)
  notifyDeleteMessage(toUserId: string, messageId: string) {
    const targetSocketId = this.connectedUsers.get(toUserId.toString());
    if (targetSocketId) {
      this.server.to(targetSocketId).emit('deleteMessage', { messageId });
    }
  }

  // Notifies the other participant that an entire conversation was deleted
  notifyConversationDeleted(toUserId: string, deletedByUserId: string) {
    const targetSocketId = this.connectedUsers.get(toUserId.toString());
    if (targetSocketId) {
      this.server
        .to(targetSocketId)
        .emit('conversationDeleted', { deletedByUserId });
    }
  }

  private getUserIdBySocketId(socketId: string): string | undefined {
    for (const [userId, id] of this.connectedUsers.entries()) {
      if (id === socketId) {
        return userId;
      }
    }
    return undefined;
  }
}
