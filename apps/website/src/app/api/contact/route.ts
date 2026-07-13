import { forwardPublicSubmission } from '@/lib/public-submissions';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return forwardPublicSubmission(request, '/api/v1/contact');
}
