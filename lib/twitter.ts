import Axios, { AxiosInstance, AxiosResponse } from 'axios'

export const http_client = (bearer: string): AxiosInstance => {
  return Axios.create({
    baseURL: 'https://api.twitter.com/2',
    timeout: 1000,
    headers: { Authorization: `Bearer ${bearer}` },
  })
}

export const search_tweets = (client: AxiosInstance) => async (term: string) => {
  const response = await client.get<any, AxiosResponse<SearchResponse>>(`/tweets/search/recent?query=${term}`)

  return response.data
}

export const get_liked = (client: AxiosInstance) => async (tweet_id: string) => {
  const response = await client.get<any, AxiosResponse<LikingUsersResponse>>(`/tweets/${tweet_id}/liking_users`)

  return response.data
}

export const get_retweeted = (client: AxiosInstance) => async (tweet_id: string) => {
  const response = await client.get<any, AxiosResponse<LikingUsersResponse>>(`/tweets/${tweet_id}/retweeted_by`)

  return response.data
}

export const lookup_users = (client: AxiosInstance) => async (user_id: string[]) => {
  const response = await client.get<any, AxiosResponse<UsersResponse>>(
    `/users/by?usernames=${user_id.join(
      ',',
    )}&user.fields=created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified,withheld`,
  )

  return response.data
}

export const twitter_client = (bearer: string) => {
  const client = http_client(bearer)

  return {
    search_tweets: search_tweets(client),
    get_liked: get_liked(client),
    get_retweeted: get_retweeted(client),
    lookup_users: lookup_users(client),
  }
}

export const USERNAME_REG = /@[A-Za-z_]*/gm
export const extract_users = (text: string): string[] | null => {
  return text.match(USERNAME_REG)
}

export const clean_name = (text: string): string => {
  return text.replace('@', '')
}

export interface SearchResponse {
  data: Tweet[]
  meta: {
    newest_id: string
    oldest_id: string
    result_count: number
    next_token: string
  }
}

export interface Tweet {
  id: string
  text: string
}

export interface LikingUsersResponse {
  data: {
    id: string
    name: string
    username: string
  }[]
  meta: {
    result_count: number
    next_token: string
  }
}

export interface UsersResponse {
  data: User[]
}

export interface User {
  id: string
  verified: boolean
  username: string
  created_at: string
  profile_image_url: string
  location: string
  url: string
  protected: boolean
  description: string
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
    listed_count: number
  }
  pinned_tweet_id: string
  name: string
}
