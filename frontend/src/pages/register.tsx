// pages/register.tsx - Redirect to unified auth page
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const Register = () => {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/auth?mode=register');
  }, [router]);
  
  return null;
};

export default Register;
