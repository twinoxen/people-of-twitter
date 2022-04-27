// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  twitter_client,
  USERNAME_REG,
  extract_users,
  clean_name,
  Tweet,
  User,
} from '../../lib/twitter';
import _ from 'lodash';

export type APIRequestBody<T> = {
  service: string;
  method: string;
  data: T;
};

export type APIResponseBody<T> = {
  result: number;
  data: T | null;
  messages: string[];
  error: Error[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<APIResponseBody<any>>
) {
  const { service, method, data } = req.body as APIRequestBody<any>;

  if (missingParams({ service, method, data }).length) {
    return res.status(400).json({
      result: 0,
      data: null,
      messages: [
        'missing required parameters.',
        ...missingParams({ service, method, data }),
      ],
      error: [],
    });
  }

  if (service === 'searchTwitter') {
    const {
      bearerToken,
      term,
      userTerms,
    } = data;

    if (missingParams({
      bearerToken,
      term,
      userTerms,
    }).length) {
      return res.status(400).json({
        result: 0,
        data: null,
        messages: [
          'missing required parameters.',
          ...missingParams({
            bearerToken,
            term,
            userTerms,
          }),
        ],
        error: [],
      });
    }

    try {
      const response = await searchTwitter(data);

      return res.status(200).json({
        result: 1,
        data: response,
        messages: [],
        error: [],
      });
    } catch (error: any) {
      return res.status(500).json({
        result: 0,
        data: null,
        messages: [error.message],
        error: [error],
      });
    }
  }

  res.status(200).json({
    result: 0,
    data: null,
    messages: ['service or method not found.'],
    error: [],
  });
}

async function searchTwitter({
  bearerToken,
  term,
  userTerms,
}: {
  bearerToken: string;
  term: string;
  userTerms: string;
}) {
  const cleanBearerToken = bearerToken.trim();

  if (!cleanBearerToken) return;

  const twitterClient = twitter_client(cleanBearerToken);

  if (!twitterClient) throw new Error('Unable to initiate twitter client');
  let results: { tweet: Tweet; users: User[]; link: string }[] = [];
  const cleanTerm = term.trim().replace(/\#/gm, '');
  const cleanUserTerms = userTerms
    .split(',')
    .map((userTerm) => userTerm.trim());

  const tweets = await twitterClient.search_tweets(cleanTerm);

  for (const tweet of tweets.data) {
    const usernames_mentioned_in_tweet: string[] = tweets.data
      .filter((tweet) => USERNAME_REG.test(tweet.text))
      .flatMap((tweet) => extract_users(tweet.text))
      .map((user) => clean_name(user || ''));

    const liked_promises = twitterClient.get_liked(tweet.id);
    const retweeted_by_promises = twitterClient.get_retweeted(tweet.id);

    const responses = await Promise.all([
      liked_promises,
      retweeted_by_promises,
    ]);

    const related_usernames = responses
      .filter((response) => response.data)
      .flatMap((response) => response.data.map((data) => data.username));

    const all_users = await twitterClient.lookup_users([
      ...related_usernames,
      ...usernames_mentioned_in_tweet,
    ]);

    const users_that = all_users.data.filter((user) => {
      return cleanUserTerms
        .map((term) => user.description.includes(term))
        .some(Boolean);
    });

    results = [
      ...results,
      {
        tweet,
        users: _.uniqBy(users_that, 'username'),
        link: `https://twitter.com/twitter/status/${tweet.id}`,
      },
    ];
  }

  return results
}

function missingParams(params: { [key: string]: any }): string[] {
  return Object.entries(params)
    .filter((param) => !param[1])
    .flatMap((param) => param[0]);
}
