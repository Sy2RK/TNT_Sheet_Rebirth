export function isOfficialQwenHost(hostname: string) {
  return (
    ['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'cn-hongkong.dashscope.aliyuncs.com'].includes(
      hostname,
    ) ||
    /^[a-z0-9-]+\.(cn-beijing|ap-southeast-1|ap-northeast-1|eu-central-1|us-east-1)\.maas\.aliyuncs\.com$/.test(
      hostname,
    )
  );
}

/** Metadata is needed: DashScope's compatible /models also includes image and audio models. */
export function qwenModelCatalogUrl(endpoint: string): URL | undefined {
  const url = new URL(endpoint);
  if (
    url.protocol !== 'https:' ||
    !isOfficialQwenHost(url.hostname) ||
    url.pathname !== '/compatible-mode/v1'
  )
    return;
  return new URL('/api/v1/models', url.origin);
}
