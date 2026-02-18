import { redirect } from 'next/navigation';

export default function SignupPage() {
  // Redirect to homepage - signup is now handled via modal
  redirect('/?signup=true');
}