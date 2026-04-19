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
import { Logger, UseGuards } from '@nestjs/common';

/** Events emitted from server to clients */
export const WS_EVENTS = {
  NEW_CASE: 'new_case',
  NEW_SIGHTING: 'new_sighting',
  CASE_UPDATED: 'case_updated',
  ALERT: 'alert',
};

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Client subscribes to a specific case room */
  @SubscribeMessage('subscribe_case')
  handleSubscribeCase(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { caseId: string },
  ) {
    client.join(`case:${data.caseId}`);
    this.logger.log(`${client.id} subscribed to case:${data.caseId}`);
  }

  /** Client subscribes to alerts in their city/area (by geohash prefix) */
  @SubscribeMessage('subscribe_area')
  handleSubscribeArea(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { geohash: string },
  ) {
    client.join(`area:${data.geohash}`);
  }

  // ─── Server-side emission helpers ──────────────────────────────────────────

  emitNewCase(caseData: any) {
    this.server.emit(WS_EVENTS.NEW_CASE, caseData);
  }

  emitNewSighting(caseId: string, sightingData: any) {
    this.server.to(`case:${caseId}`).emit(WS_EVENTS.NEW_SIGHTING, sightingData);
  }

  emitCaseUpdated(caseId: string, updateData: any) {
    this.server.to(`case:${caseId}`).emit(WS_EVENTS.CASE_UPDATED, updateData);
    this.server.emit(WS_EVENTS.CASE_UPDATED, updateData); // also broadcast globally
  }
}
