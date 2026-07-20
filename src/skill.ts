import type { Request, Response } from 'express';
import { getOrCreateAlias, getPlayer, setAlias } from './repository.js';
import { effectImagePath, skinStateImagePath, speciesImagePath } from './assets.js';
import { throwPoop } from './logic/throwPoop.js';
import { flushToilet } from './logic/flushToilet.js';
import { enhanceToilet } from './logic/enhanceToilet.js';
import { useBidet } from './logic/useBidet.js';
import { usePerfume } from './logic/usePerfume.js';
import { buildDex, buildStatus } from './logic/status.js';
import { selectSkin } from './logic/selectSkin.js';
import {
  formatBidetResult,
  formatDex,
  formatEnhanceResult,
  formatFlushResult,
  formatPerfumeResult,
  formatSelectSkinResult,
  formatStatus,
  formatThrowResult,
} from './formatters.js';

// Kakao i OpenBuilder's Skill payload has no room/chat identifier - only a
// per-bot-per-user id - so this integration path can't distinguish between
// group chats the channel is added to. Everyone through /skill shares one
// game space; a real multi-room OpenBuilder deployment would need Kakao's
// paid business messaging APIs to get a room id, which is out of scope here.
const ROOM_CODE = 'kakao_channel';

const LEVEL_SKINS = ['lv0_worn', 'lv1_white', 'lv2_stainless', 'lv3_marble', 'lv4_nanotech', 'lv5_throne'];

function kakaoResponse(text: string, imageUrl?: string) {
  const outputs: Record<string, unknown>[] = [{ simpleText: { text } }];
  if (imageUrl) outputs.push({ simpleImage: { imageUrl, altText: '똥폭탄' } });
  return { version: '2.0', template: { outputs } };
}

const HELP_TEXT =
  '💩 똥폭탄, 던질 준비 되셨나요?\n\n' +
  '명령어:\n' +
  '· 발사 @대상 - 똥폭탄 던지기\n' +
  '· 변기 열기 - 내 상태 확인\n' +
  '· 물 내리기 - 변기 비우기\n' +
  '· 변기 강화 - 변기 업그레이드\n' +
  '· 비데 사용 - 나쁜 운세 해제\n' +
  '· 퍼퓸 사용 - 변기 즉시 비우기\n' +
  '· 도감 - 수집 현황 보기\n' +
  '· 변기 선택 [번호] - 스킨 교체\n' +
  '· 닉네임 [이름] - 닉네임 바꾸기';

/** Handles Kakao i OpenBuilder Skill requests. Always responds 200 with a
 *  valid Kakao skill-response JSON body, even on internal errors, since the
 *  OpenBuilder relay expects that shape regardless of outcome. */
export function handleSkillRequest(req: Request, res: Response): void {
  try {
    const baseUrl = `${(req.headers['x-forwarded-proto'] as string) || 'https'}://${req.get('host')}`;
    const assetUrl = (relativePath: string | undefined) =>
      relativePath ? `${baseUrl}/assets/${relativePath}` : undefined;

    const utterance: string = req.body?.userRequest?.utterance ?? '';
    const platformUserId: string = req.body?.userRequest?.user?.id ?? 'unknown';
    const nickname = getOrCreateAlias(platformUserId);

    const nicknameCmd = utterance.match(/^닉네임\s*(?:설정)?\s*(\S+)/);
    if (nicknameCmd) {
      const result = setAlias(platformUserId, nicknameCmd[1]);
      res.json(kakaoResponse(result.success ? `✅ 닉네임을 [${nicknameCmd[1]}]로 설정했습니다!` : `❌ ${result.message}`));
      return;
    }

    if (/발사|던져/.test(utterance)) {
      const mention = utterance.match(/@(\S+)/);
      const result = throwPoop(ROOM_CODE, nickname, mention?.[1]);
      const image = result.species_id !== undefined ? assetUrl(speciesImagePath(result.species_id)) : undefined;
      res.json(kakaoResponse(formatThrowResult(result), image));
      return;
    }
    if (/물\s*내리기/.test(utterance)) {
      const result = flushToilet(ROOM_CODE, nickname);
      const skin = getPlayer(ROOM_CODE, nickname).equipped_skin;
      res.json(kakaoResponse(formatFlushResult(result), assetUrl(skinStateImagePath(skin, result.new_stack))));
      return;
    }
    if (/변기\s*강화/.test(utterance)) {
      const result = enhanceToilet(ROOM_CODE, nickname);
      res.json(kakaoResponse(formatEnhanceResult(result), assetUrl(skinStateImagePath(LEVEL_SKINS[result.new_level], 0))));
      return;
    }
    if (/비데/.test(utterance)) {
      const result = useBidet(ROOM_CODE, nickname);
      const image = assetUrl(result.changed ? effectImagePath('bidet_success') : effectImagePath('bidet_fail'));
      res.json(kakaoResponse(formatBidetResult(result), image));
      return;
    }
    if (/퍼퓸|향수/.test(utterance)) {
      const result = usePerfume(ROOM_CODE, nickname);
      res.json(kakaoResponse(formatPerfumeResult(result), result.success ? assetUrl(effectImagePath('perfume')) : undefined));
      return;
    }
    if (/도감/.test(utterance)) {
      res.json(kakaoResponse(formatDex(buildDex(ROOM_CODE, nickname))));
      return;
    }
    if (/변기\s*선택/.test(utterance)) {
      const skinArg = utterance.match(/변기\s*선택\s*(\S+)/);
      const result = selectSkin(ROOM_CODE, nickname, skinArg?.[1]);
      const image = result.success && result.skin_id ? assetUrl(skinStateImagePath(result.skin_id, 0)) : undefined;
      res.json(kakaoResponse(formatSelectSkinResult(result), image));
      return;
    }
    if (/변기\s*(열기|확인)/.test(utterance)) {
      const result = buildStatus(ROOM_CODE, nickname);
      res.json(kakaoResponse(formatStatus(result), assetUrl(skinStateImagePath(result.equipped_skin, result.stack))));
      return;
    }

    res.json(kakaoResponse(`${HELP_TEXT}\n\n(현재 닉네임: ${nickname})`));
  } catch (err) {
    console.error('Error handling /skill request:', err);
    res.json(kakaoResponse('오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
  }
}
