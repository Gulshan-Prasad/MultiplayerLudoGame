import { memo } from 'react';
import { useGame } from '../context/GameContext';
import { GAME_PHASES, GAME_STATUS } from '../data/constants';
import CooldownBarButton from './CooldownBarButton';

function TurnActionButton({ onRoll, showCooldown = false, isActive = true, waitingName = '' }) {
  const { state } = useGame();
  const { gamePhase, gameStatus, diceRolling, turnTimer } = state;

  if (gameStatus !== GAME_STATUS.IN_PROGRESS) return null;

  const cooldownActive = showCooldown && !diceRolling;
  const className = 'w-32 sm:w-40 max-w-full';

  if (!isActive) {
    return (
      <CooldownBarButton
        disabled
        turnTimer={turnTimer}
        cooldownActive={cooldownActive}
        fillColor="var(--gray)"
        className={className}
      >
        {waitingName ? `Waiting for ${waitingName}...` : 'Waiting...'}
      </CooldownBarButton>
    );
  }

  if (gamePhase === GAME_PHASES.ROLLING && !diceRolling) {
    return (
      <CooldownBarButton
        onClick={onRoll}
        turnTimer={turnTimer}
        cooldownActive={cooldownActive}
        fillColor="var(--blue)"
        className={className}
        taller
      >
        🎲 Roll Dice
      </CooldownBarButton>
    );
  }

  if (gamePhase === GAME_PHASES.ROLLING && diceRolling) {
    return (
      <CooldownBarButton
        disabled
        turnTimer={turnTimer}
        cooldownActive={false}
        fillColor="var(--gray)"
        className={className}
      >
        Rolling…
      </CooldownBarButton>
    );
  }

  if (gamePhase === GAME_PHASES.SELECTING_PIECE) {
    return (
      <CooldownBarButton
        disabled
        turnTimer={turnTimer}
        cooldownActive={cooldownActive}
        fillColor="var(--gray)"
        className={className}
      >
        Select a piece to move
      </CooldownBarButton>
    );
  }

  if (gamePhase === GAME_PHASES.TURN_COMPLETE) {
    return (
      <CooldownBarButton
        disabled
        turnTimer={turnTimer}
        cooldownActive={false}
        fillColor="var(--green)"
        className={className}
      >
        Turn passing…
      </CooldownBarButton>
    );
  }

  return null;
}

export default memo(TurnActionButton);
