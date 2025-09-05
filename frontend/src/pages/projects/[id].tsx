import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function RedirectProject() {
  const router = useRouter();
  
  useEffect(() => {
    if (router.isReady && router.query.id) {
      router.replace(`/metrics/configure/${router.query.id}`);
    }
  }, [router.isReady, router.query.id, router]);
  
  return null;
}
