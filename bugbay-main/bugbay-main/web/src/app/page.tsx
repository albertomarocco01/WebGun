/** Home del daemon: reindirizza alla console di triage. */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/debugging');
}
