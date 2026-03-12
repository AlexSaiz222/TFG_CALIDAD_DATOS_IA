// pages/login.tsx - Redirect to unified auth page
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const Login = () => {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/auth');
  }, [router]);
  
  return null;
};

export default Login;
