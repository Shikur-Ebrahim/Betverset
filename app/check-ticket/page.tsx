import type { Metadata } from 'next';
import CheckTicketClient from '@/components/check-ticket-client';

export const metadata: Metadata = {
  title: 'Check ticket',
};

export default function CheckTicketPage() {
  return <CheckTicketClient />;
}
