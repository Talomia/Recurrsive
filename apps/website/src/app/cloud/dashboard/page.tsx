import { redirect } from 'next/navigation';

export default function CloudDashboardPage() {
  redirect(process.env.DASHBOARD_URL ?? '/docs/deployment');
}
