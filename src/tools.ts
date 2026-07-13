import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ensurePlayer } from './repository.js';
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

const SERVICE_TAG = 'Ddongpoktan(똥폭탄)';

const roomAndNickname = {
  room_code: z
    .string()
    .min(1)
    .max(64)
    .describe(
      'Room code that groups players into the same Ddongpoktan(똥폭탄) game session. Chosen by the players themselves (e.g. a word they agree on), not a KakaoTalk chat room ID.',
    ),
  nickname: z
    .string()
    .min(1)
    .max(32)
    .describe('The speaker\'s own nickname within the room. Used to identify the calling player.'),
};

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    'throw_poop',
    {
      title: 'Throw Poop',
      description:
        `Throws a random poop at another player in ${SERVICE_TAG}, a chaotic KakaoTalk group-chat game. ` +
        'Rolls a random poop tier (basic 75%, rainbow 12%, bomb 8%, golden 4%, diamond 1%) and applies its ' +
        "effect: stacking poop on the target's toilet, granting coins, or triggering room-wide events " +
        '(bomb ends the round; golden taxes every other room member 20 coins to the thrower; diamond seizes ' +
        "30% of every other room member's coins to the thrower). If target_nickname is omitted, automatically " +
        'retaliates against whoever last hit the caller.',
      inputSchema: {
        ...roomAndNickname,
        target_nickname: z
          .string()
          .min(1)
          .max(32)
          .optional()
          .describe('Nickname of the player to throw at. Omit to retaliate against the last attacker.'),
      },
      annotations: {
        title: 'Throw Poop',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname, target_nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = throwPoop(room_code, nickname, target_nickname);
      return textResult(formatThrowResult(result));
    },
  );

  server.registerTool(
    'flush_toilet',
    {
      title: 'Flush Toilet',
      description:
        `Attempts to flush the caller's own toilet in ${SERVICE_TAG}, clearing their accumulated poop stack. ` +
        "Success chance is based on the caller's toilet enhancement level (60%-85%). On failure, 1-3 more " +
        'poop get added to the stack instead.',
      inputSchema: { ...roomAndNickname },
      annotations: {
        title: 'Flush Toilet',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = flushToilet(room_code, nickname);
      return textResult(formatFlushResult(result));
    },
  );

  server.registerTool(
    'enhance_toilet',
    {
      title: 'Enhance Toilet',
      description:
        `Spends coins to attempt upgrading the caller's toilet enhancement level (Lv.0-5) in ${SERVICE_TAG}. ` +
        'Higher levels raise the flush success rate. Attempts to reach Lv.3-5 risk a full reset back to Lv.0 ' +
        'after two consecutive failures at the same level. Unlocks cosmetic toilet skins at each level.',
      inputSchema: { ...roomAndNickname },
      annotations: {
        title: 'Enhance Toilet',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = enhanceToilet(room_code, nickname);
      return textResult(formatEnhanceResult(result));
    },
  );

  server.registerTool(
    'use_bidet',
    {
      title: 'Use Bidet',
      description:
        `Spends coins to clear the caller's "bad fortune" debuff in ${SERVICE_TAG} (which is triggered when ` +
        'their toilet stack fills up to the max and blocks all coin gains). No-op if the caller does not ' +
        'currently have bad fortune.',
      inputSchema: { ...roomAndNickname },
      annotations: {
        title: 'Use Bidet',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = useBidet(room_code, nickname);
      return textResult(formatBidetResult(result));
    },
  );

  server.registerTool(
    'use_perfume',
    {
      title: 'Use Perfume',
      description:
        `Spends coins to instantly and guaranteedly clear the caller's own toilet stack in ${SERVICE_TAG}, ` +
        'as a reliable (but costlier) alternative to the probabilistic flush_toilet.',
      inputSchema: { ...roomAndNickname },
      annotations: {
        title: 'Use Perfume',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = usePerfume(room_code, nickname);
      return textResult(formatPerfumeResult(result));
    },
  );

  server.registerTool(
    'check_status',
    {
      title: 'Check Status',
      description:
        `Reports the caller's current state in ${SERVICE_TAG}: toilet stack, enhancement level, fortune ` +
        'status, coin balance, recent coin history, and unlocked toilet skins.',
      inputSchema: { ...roomAndNickname },
      annotations: {
        title: 'Check Status',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = buildStatus(room_code, nickname);
      return textResult(formatStatus(result));
    },
  );

  server.registerTool(
    'check_dex',
    {
      title: 'Check Dex',
      description:
        `Shows the caller's poop collection ("dex") in ${SERVICE_TAG} out of all 28 species, with how many ` +
        'times each has been received.',
      inputSchema: { ...roomAndNickname },
      annotations: {
        title: 'Check Dex',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname }) => {
      ensurePlayer(room_code, nickname);
      const result = buildDex(room_code, nickname);
      return textResult(formatDex(result));
    },
  );

  server.registerTool(
    'select_skin',
    {
      title: 'Select Toilet Skin',
      description:
        `Lists or equips the caller's toilet skins in ${SERVICE_TAG}. Call with skin omitted to list all 10 ` +
        'skins (index, name, locked/unlocked/equipped status). Call with skin set to a listed index (0-9) or ' +
        "skin id to equip an already-unlocked skin; equipping a locked skin fails with an explanatory message.",
      inputSchema: {
        ...roomAndNickname,
        skin: z
          .string()
          .min(1)
          .max(32)
          .optional()
          .describe('Skin index (0-9) or skin id to equip. Omit to list all skins and their status.'),
      },
      annotations: {
        title: 'Select Toilet Skin',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ room_code, nickname, skin }) => {
      ensurePlayer(room_code, nickname);
      const result = selectSkin(room_code, nickname, skin);
      return textResult(formatSelectSkinResult(result));
    },
  );
}
