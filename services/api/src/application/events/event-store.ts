/**
 * Repository port for the events bounded context, plus the in-memory adapter
 * (the Drizzle adapter lands with the events persistence tasks).
 */

import type { BookableEvent, EventAttendee, TicketType } from "@saas-reservas/domain/events/event";

export interface EventStore {
  insertEvent(event: BookableEvent): Promise<void>;
  updateEvent(event: BookableEvent): Promise<void>;
  findEventById(tenantId: string, eventId: string): Promise<BookableEvent | null>;
  listEventsBySeries(tenantId: string, seriesId: string): Promise<BookableEvent[]>;
  insertTicketType(ticket: TicketType): Promise<void>;
  findTicketTypeById(tenantId: string, ticketTypeId: string): Promise<TicketType | null>;
  listTicketTypes(tenantId: string, eventId: string): Promise<TicketType[]>;
  insertAttendee(attendee: EventAttendee): Promise<void>;
  updateAttendee(attendee: EventAttendee): Promise<void>;
  findAttendeeById(tenantId: string, attendeeId: string): Promise<EventAttendee | null>;
  listAttendees(tenantId: string, eventId: string): Promise<EventAttendee[]>;
}

export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, BookableEvent>();
  private readonly tickets = new Map<string, TicketType>();
  private readonly attendees = new Map<string, EventAttendee>();

  insertEvent(event: BookableEvent): Promise<void> {
    this.events.set(event.id, event);
    return Promise.resolve();
  }

  updateEvent(event: BookableEvent): Promise<void> {
    this.events.set(event.id, event);
    return Promise.resolve();
  }

  findEventById(tenantId: string, eventId: string): Promise<BookableEvent | null> {
    const event = this.events.get(eventId);
    return Promise.resolve(event?.tenantId === tenantId ? event : null);
  }

  listEventsBySeries(tenantId: string, seriesId: string): Promise<BookableEvent[]> {
    return Promise.resolve(
      [...this.events.values()].filter(
        (event) => event.tenantId === tenantId && event.seriesId === seriesId,
      ),
    );
  }

  insertTicketType(ticket: TicketType): Promise<void> {
    this.tickets.set(ticket.id, ticket);
    return Promise.resolve();
  }

  findTicketTypeById(tenantId: string, ticketTypeId: string): Promise<TicketType | null> {
    const ticket = this.tickets.get(ticketTypeId);
    return Promise.resolve(ticket?.tenantId === tenantId ? ticket : null);
  }

  listTicketTypes(tenantId: string, eventId: string): Promise<TicketType[]> {
    return Promise.resolve(
      [...this.tickets.values()].filter(
        (ticket) => ticket.tenantId === tenantId && ticket.eventId === eventId,
      ),
    );
  }

  insertAttendee(attendee: EventAttendee): Promise<void> {
    this.attendees.set(attendee.id, attendee);
    return Promise.resolve();
  }

  updateAttendee(attendee: EventAttendee): Promise<void> {
    this.attendees.set(attendee.id, attendee);
    return Promise.resolve();
  }

  findAttendeeById(tenantId: string, attendeeId: string): Promise<EventAttendee | null> {
    const attendee = this.attendees.get(attendeeId);
    return Promise.resolve(attendee?.tenantId === tenantId ? attendee : null);
  }

  listAttendees(tenantId: string, eventId: string): Promise<EventAttendee[]> {
    return Promise.resolve(
      [...this.attendees.values()].filter(
        (attendee) => attendee.tenantId === tenantId && attendee.eventId === eventId,
      ),
    );
  }
}
