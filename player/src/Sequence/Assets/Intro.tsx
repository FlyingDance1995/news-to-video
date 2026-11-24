import { OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import { z } from "zod";
import { FC } from "react";
import { customCutsSchema } from "@videofy/types";

interface Props {
  asset: z.infer<typeof customCutsSchema>; // Changed type
  introDuration: number;
}

export const Intro: FC<Props> = ({ asset, introDuration }) => {
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;

  return (
    <Sequence durationInFrames={introDuration} premountFor={10}>
      {/* muted=true: intro video plays silently */}
      {isPortrait ? (
        <OffthreadVideo transparent src={asset.portrait} muted />
      ) : (
        <OffthreadVideo transparent src={asset.landscape} muted />
      )}
    </Sequence>
  );
};
