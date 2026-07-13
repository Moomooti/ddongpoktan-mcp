import type { BidetResult } from './logic/useBidet.js';
import type { EnhanceResult } from './logic/enhanceToilet.js';
import type { FlushResult } from './logic/flushToilet.js';
import type { PerfumeResult } from './logic/usePerfume.js';
import type { SelectSkinResult } from './logic/selectSkin.js';
import type { DexResult, StatusResult } from './logic/status.js';
import type { ThrowResult } from './types.js';

const SKIN_LABELS: Record<string, string> = {
  lv0_worn: '낡은 변기',
  lv1_white: '새하얀 변기',
  lv2_stainless: '스테인리스 변기',
  lv3_marble: '대리석 변기',
  lv4_nanotech: '나노테크 변기',
  lv5_throne: '옥좌',
  rainbow: '알록달록 무지개 변기',
  golden: '황금 변기',
  diamond: '다이아 변기',
  allstar: '올스타 변기',
};

function skinList(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return '';
  const names = ids.map((id) => SKIN_LABELS[id] ?? id).join(', ');
  return `\n🏆 새 변기 스킨 해금: ${names}`;
}

export function formatThrowResult(result: ThrowResult): string {
  if (result.error === 'NO_TARGET') return `❓ ${result.message}`;
  if (result.error === 'SELF_TARGET') return `❓ ${result.message}`;

  const lines: string[] = [];
  lines.push(result.is_new_discovery ? '🆕 처음 발견한 똥이네요! 도감에 새로운 똥이 추가됐어요.' : '✨ 이미 도감에 등록된 똥입니다.');
  lines.push(`💩 [${result.species_name}]을(를) ${result.target}님에게 던졌습니다!`);
  lines.push(`🎯 피격 대상: ${result.target}`);
  if (result.today_throw_count) lines.push(`💩 오늘 던진 똥의 개수: ${result.today_throw_count}개`);

  switch (result.event) {
    case 'rainbow':
      lines.push(
        `🌈 무지개 똥이다! 던진 사람과 맞은 사람 모두 30분간 [좋은 운세] 버프(강화 코인 획득 +50%)를 받았습니다.`,
      );
      break;
    case 'bomb':
      lines.push(`💣 폭탄 똥이 터졌습니다! 이번 라운드가 종료되고, 마지막 투척자가 최종 승리했습니다!`);
      break;
    case 'golden':
      lines.push(
        `👑 황금 똥이다! [황금 변기 독점 알현] 황금 변기의 신이 강림하여 단톡방 멤버들의 코인을 수금합니다!`,
      );
      break;
    case 'diamond':
      lines.push(`💎 다이아 똥이다! [광역 자산 압류] 단톡방에 압류 딱지가 붙었습니다. 전원 잔고의 30%를 몰수합니다!`);
      break;
  }

  if (result.event !== 'bomb') {
    lines.push(`${result.target}님의 변기 스택: ${result.target_new_stack}/10`);
  }
  lines.push(`(+${result.coin_earned} 코인 획득)`);
  if (result.room_tax && result.room_tax.entries.length > 0) {
    lines.push(`🧾 ${result.room_tax.label} 내역`);
    for (const entry of result.room_tax.entries) {
      lines.push(`  ${entry.userId}: -${entry.amount}`);
    }
    lines.push(`(총 ${result.room_tax.total} 코인 추가 수금)`);
  }
  if (result.daily_bonus) lines.push('🎁 오늘의 첫 던지기 출석 보너스 +300 코인!');
  if (
    result.dex_collected !== undefined &&
    result.dex_total !== undefined &&
    !(result.unlocked_skins ?? []).includes('allstar')
  ) {
    lines.push(`🏆 [업적] 올스타 변기 도전 중! (${result.dex_collected}/${result.dex_total})`);
  }
  lines.push(skinList(result.unlocked_skins));

  return lines.filter(Boolean).join('\n');
}

export function formatFlushResult(result: FlushResult): string {
  if (result.success) {
    return `🚽 물을 내렸습니다! 변기가 깨끗해졌습니다. (스택 0/10)`;
  }
  return `🚽 물내리기 실패... 역류해서 변기에 똥이 더 쌓였습니다. (현재 스택 ${result.new_stack}/10)`;
}

export function formatEnhanceResult(result: EnhanceResult): string {
  // message is only set when no attempt was made (already max level, or insufficient coin).
  if (result.message) {
    return `🔧 ${result.message}`;
  }
  const lines: string[] = [];
  if (result.success) {
    lines.push(`🔧 변기 강화 성공! Lv.${result.new_level}로 업그레이드되었습니다. (-${result.coin_spent} 코인)`);
  } else if (result.reset_triggered) {
    lines.push(
      `🔧 변기 강화 실패... 연속 2회 실패로 변기가 Lv.0으로 완전히 초기화되었습니다. (-${result.coin_spent} 코인)`,
    );
  } else {
    lines.push(`🔧 변기 강화 실패. 코인만 소멸했습니다. (-${result.coin_spent} 코인, 레벨 유지: Lv.${result.new_level})`);
  }
  lines.push(skinList(result.unlocked_skins));
  return lines.filter(Boolean).join('\n');
}

export function formatBidetResult(result: BidetResult): string {
  if (!result.changed) return `🚿 ${result.message}`;
  return `🚿 비데를 사용했습니다. 나쁜 운세가 해제되었습니다.`;
}

export function formatPerfumeResult(result: PerfumeResult): string {
  if (!result.success) return `🌸 ${result.message}`;
  return `🌸 방향제를 뿌렸습니다. 꽃향기가 퍼지며 변기가 즉시 깨끗해졌습니다! (스택 0/10)`;
}

const FORTUNE_LABEL: Record<string, string> = { none: '없음', good: '좋은 운세 🍀', bad: '나쁜 운세 💀' };

export function formatStatus(result: StatusResult): string {
  const lines: string[] = [];
  lines.push(`🚽 변기 스택: ${result.stack}/${result.max_stack}`);
  lines.push(`🔧 강화 레벨: Lv.${result.enhance_level}`);
  lines.push(`🔮 운세 상태: ${FORTUNE_LABEL[result.fortune_state] ?? result.fortune_state}`);
  lines.push(`🪙 보유 코인: ${result.coin_balance}`);
  if (result.unlocked_skins.length > 0) {
    lines.push(`🏆 보유 스킨: ${result.unlocked_skins.map((id) => SKIN_LABELS[id] ?? id).join(', ')}`);
  }
  if (result.coin_recent.length > 0) {
    lines.push('최근 코인 내역:');
    for (const entry of result.coin_recent.slice(0, 5)) {
      const sign = entry.delta >= 0 ? '+' : '';
      lines.push(`  ${sign}${entry.delta} (${entry.reason})`);
    }
  }
  return lines.join('\n');
}

export function formatDex(result: DexResult): string {
  const lines: string[] = [];
  lines.push(`📖 똥 도감: ${result.collected_count}/${result.total}종 수집`);
  for (const entry of result.collected) {
    lines.push(`  #${entry.species_id} ${entry.name} - ${entry.hit_count}회`);
  }
  if (result.collected.length === 0) lines.push('  아직 수집한 똥이 없습니다. 던지기를 해보세요!');
  return lines.join('\n');
}

export function formatSelectSkinResult(result: SelectSkinResult): string {
  if (result.listed && result.list) {
    const lines: string[] = ['🚽 변기 보관함'];
    for (const entry of result.list) {
      const label = SKIN_LABELS[entry.skin_id] ?? entry.skin_id;
      const status = entry.equipped ? ' (장착 중)' : entry.unlocked ? '' : ' (잠김)';
      lines.push(`${entry.index}. ${label}${status}`);
    }
    lines.push('장착하려면 "변기 선택 [번호]" 형식으로 입력해주세요.');
    return lines.join('\n');
  }
  if (!result.success) return `🔒 ${result.message}`;
  return `🚽 변기 스킨 교체 완료! [${SKIN_LABELS[result.skin_id!] ?? result.skin_id}]로 장착했습니다.`;
}
