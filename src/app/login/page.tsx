import { redirect } from 'next/navigation';

export default function LoginPage() {
  // Redirect to homepage - login is now handled via modal
  // Users can click the user icon and select parent/caregiver
  redirect('/');
}
