import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { handleSkillRequest } from '../src/skill.js';
import { rigRandom } from './helpers.js';

interface KakaoBody {
  version: string;
  template: { outputs: ({ simpleText?: { text: string } } & { simpleImage?: { imageUrl: string } })[] };
}

/** Calls the Kakao OpenBuilder route with a hand-made request and returns the JSON it sent. */
function callSkill(body: unknown): KakaoBody {
  let sent: KakaoBody | undefined;
  const req = { body, headers: { 'x-forwarded-proto': 'https' }, get: () => 'example.test' } as unknown as Request;
  const res = {
    json: (payload: KakaoBody) => {
      sent = payload;
      return res;
    },
  } as unknown as Response;
  handleSkillRequest(req, res);
  if (!sent) throw new Error('route did not respond');
  return sent;
}

describe('/skill (Kakao OpenBuilder)', () => {
  it('always answers in Kakao skill-response shape, even for a malformed body', () => {
    for (const body of [undefined, null, 'oops', { userRequest: 42 }, { userRequest: { user: { id: '' } } }]) {
      const out = callSkill(body);
      expect(out.version).toBe('2.0');
      expect(out.template.outputs[0].simpleText?.text).toContain('똥폭탄');
    }
  });

  it('sends the illustration as a native image block (not a URL in the text)', () => {
    rigRandom(0);
    callSkill({ userRequest: { utterance: '닉네임 상대', user: { id: 'user-target-1' } } });
    const out = callSkill({ userRequest: { utterance: '발사 @상대', user: { id: 'user-thrower-1' } } });
    const image = out.template.outputs.find((o) => o.simpleImage)?.simpleImage;
    expect(image?.imageUrl).toMatch(/^https:\/\/example\.test\/assets\/species\//);
    expect(out.template.outputs[0].simpleText?.text).not.toContain('https://');
  });
});
