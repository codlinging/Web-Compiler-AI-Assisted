

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: { experiments: any; }) => {
    // This allows Webpack to load WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;