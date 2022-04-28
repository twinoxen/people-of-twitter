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
  error: any;
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
    const { bearerToken, term, userTerms } = data;

    if (
      missingParams({
        bearerToken,
        term,
        userTerms,
      }).length
    ) {
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
        result: response?.length || 0,
        data: response,
        messages: [],
        error: [],
      });
    } catch (error: any) {
      return res.status(500).json({
        result: 0,
        data: null,
        messages: [error.message],
        error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
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
  let results: {
    tweet: Tweet;
    users: (User | undefined)[];
    link: string;
    mentioned: (User | undefined)[];
    liked: (User | undefined)[];
    retweeted: (User | undefined)[];
  }[] = [];
  const cleanTerm = term.trim().replace(/\#/gm, '');
  const cleanUserTerms = userTerms
    .split(',')
    .map((userTerm) => userTerm.trim());

  const tweets = await twitterClient.search_tweets(cleanTerm);

  for (const tweet of tweets.data) {
    const usernames_mentioned_in_tweet: string[] = [tweet]
      .filter((tweet) => USERNAME_REG.test(tweet.text))
      .flatMap((tweet) => extract_users(tweet.text))
      .map((user) => clean_name(user || ''));

    const likedResponse = await twitterClient.get_liked(tweet.id);
    const retweetedResponse = await twitterClient.get_retweeted(tweet.id);

    const liked = likedResponse.data
      ? likedResponse.data.map((data) => data.username)
      : [];
    const retweeted = retweetedResponse.data
      ? retweetedResponse?.data.map((data) => data.username)
      : [];

    const user_details = await twitterClient.lookup_users(
      _.uniq([...liked, ...retweeted, ...usernames_mentioned_in_tweet])
    );

    results = [
      ...results,
      {
        tweet,
        users: user_details.data.filter(usersWhoMatchTerms(cleanUserTerms)),
        link: `https://twitter.com/twitter/status/${tweet.id}`,
        mentioned: usernames_mentioned_in_tweet
          .map(userNameToUserDetails(user_details.data))
          .filter(usersWhoMatchTerms(cleanUserTerms)),
        liked: liked
          .map(userNameToUserDetails(user_details.data))
          .filter(usersWhoMatchTerms(cleanUserTerms)),
        retweeted: retweeted
          .map(userNameToUserDetails(user_details.data))
          .filter(usersWhoMatchTerms(cleanUserTerms)),
      },
    ];
  }

  return results;
}

function missingParams(params: { [key: string]: any }): string[] {
  return Object.entries(params)
    .filter((param) => !param[1])
    .flatMap((param) => param[0]);
}

const usersWhoMatchTerms = (terms: string[]) => (user: User | undefined) => {
  if (!user) return false;

  return terms
    .map((term: string) => {
      const reg = new RegExp(term, 'gmi');
      return reg.test(user.description);
    })
    .some(Boolean);
};

const userNameToUserDetails = (users: User[]) => (username: string) => {
  return _.find(users, ['username', username]);
};
