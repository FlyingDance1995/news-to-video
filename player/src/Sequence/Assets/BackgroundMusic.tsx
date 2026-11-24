import { Audio, Sequence } from "remotion";
import { processedManuscriptSchema } from "@videofy/types";
import { z } from "zod";
import { FC } from "react";

interface Props {
  manuscripts: Array<z.infer<typeof processedManuscriptSchema>>;
  backgroundMusic?: string;
  volume?: number;
}

export const BackgroundMusic: FC<Props> = ({ backgroundMusic, volume }) => {
  if (!backgroundMusic) {
    return null;
  }
  // Cap background music at 5% regardless of what playerConfig passes in
  const clampedVolume = Math.min(volume ?? 0.05, 0.05);
  return (
    <Sequence>
      <Audio src={backgroundMusic} volume={clampedVolume} loop />
    </Sequence>
  );
};
