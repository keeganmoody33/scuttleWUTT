declare module 'google-trends-api' {
  interface TrendsOptions {
    keyword?: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    granularTimeResolution?: boolean;
  }

  const googleTrends: {
    interestOverTime: (options: TrendsOptions) => Promise<any>;
    relatedQueries: (options: TrendsOptions) => Promise<any>;
  };

  export default googleTrends;
}
