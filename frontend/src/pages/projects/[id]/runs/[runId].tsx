import { useEffect } from 'react';
import { useRouter } from 'next/router';

const AnalysisRunRedirect = () => {
  const router = useRouter();
  const { runId } = router.query;

  useEffect(() => {
    if (router.isReady && runId) {
      router.replace(`/evaluations/${runId}`);
    }
  }, [router.isReady, runId]);

  return null;
};

export default AnalysisRunRedirect;
