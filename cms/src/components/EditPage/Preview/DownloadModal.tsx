"use client";

import {
  Alert,
  App,
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Radio,
  Switch,
  Typography,
} from "antd";
import { CopyOutlined, LoadingOutlined } from "@ant-design/icons";
import { type FC, useMemo } from "react";
import { useReactive } from "ahooks";
import { useGlobalState } from "@/state/globalState";
import { logAIData } from "@/actions/logAIData";

const videoTypes = [
  { name: "Vertical",        description: "Video dọc (1080x1920)" },
  { name: "Horizontal",      description: "Video ngang (1920x1080)" },
  { name: "Sound only",      description: "Âm thanh thuyết minh (mp3)" },
  { name: "Videofy Project", description: "File dự án (JSON)" },
];

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type FormType = {
  exportType: string;
  logo: boolean;
  audio: boolean;
  voice: boolean;
  music: boolean;
  title: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract keywords from a title string (words ≥ 3 chars, deduped, lowercased). */
function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    "và", "của", "là", "có", "trong", "với", "các", "một", "những", "này",
    "đã", "được", "cho", "về", "từ", "theo", "khi", "như", "sau", "trước",
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
    "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
    "its", "she", "two", "use", "who", "will",
  ]);
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-zA-ZÀ-ỹ0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopwords.has(w))
    ),
  ];
}

/** Build a YouTube-ready description from title + script lines. */
function buildDescription(title: string, scriptLines: string[]): string {
  const keywords = extractKeywords(title);
  const keywordPhrase = keywords.slice(0, 5).join(", ");

  const scriptBody =
    scriptLines.length > 0
      ? scriptLines.map((l) => `• ${l}`).join("\n")
      : "Content coming soon.";

  return [
    `🎬 ${title}`,
    "",
    scriptBody,
    "",
    `📌 In this video, we cover: ${keywordPhrase}.`,
    "",
    "👍 If you find this video helpful, please LIKE and SUBSCRIBE so you never miss our latest videos!",
    "🔔 Hit the notification bell to get alerted the moment a new video drops.",
    "💬 Drop a comment below if you have any questions or thoughts!",
    "",
    "📢 Share this video with friends and family to keep everyone informed!",
    "",
    "─────────────────────────────",
    "🙏 Thank you for watching and supporting the channel!",
    "Your support means the world to us and keeps us motivated to create quality content.",
    "─────────────────────────────",
    "",
    `#${keywords.slice(0, 3).map((k) => k.replace(/\s+/g, "")).join(" #")}`,
  ].join("\n");
}

/** Build YouTube tags: channel tags + topic tags + keyword tags. */
function buildTags(title: string, scriptLines: string[]): string[] {
  const channelTags = ["news", "breaking news", "latest news", "news update", "world news"];

  const topicKeywords = extractKeywords(title);
  const contentText = scriptLines.join(" ");
  const contentKeywords = extractKeywords(contentText)
    .filter((k) => !topicKeywords.includes(k))
    .slice(0, 8);

  const longTailTags = topicKeywords.slice(0, 3).map((k) => `${k} 2024`);

  const allTags = [
    ...channelTags,
    ...topicKeywords.slice(0, 7),
    ...contentKeywords,
    ...longTailTags,
  ];

  return [...new Map(allTags.map((t) => [t.toLowerCase(), t])).values()];
}

// ─── CopyButton ─────────────────────────────────────────────────────────────

const CopyButton: FC<{ getValue: () => string; label?: string }> = ({
  getValue,
  label = "Copy",
}) => {
  const { notification } = App.useApp();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getValue());
      notification.success({ message: `Đã sao chép ${label}!`, duration: 2 });
    } catch {
      notification.error({ message: "Sao chép thất bại.", duration: 2 });
    }
  };

  return (
    <Button
      icon={<CopyOutlined />}
      size="small"
      onClick={handleCopy}
      title={`Sao chép ${label}`}
    >
      Copy
    </Button>
  );
};

// ─── DownloadModal ───────────────────────────────────────────────────────────

const DownloadModal: FC<Props> = ({ open, setOpen }) => {
  const { tabs, processedManuscripts, generationId } = useGlobalState();
  const {
    config: { config },
  } = useGlobalState();
  const { notification } = App.useApp();
  const [downloadForm] = Form.useForm<FormType>();

  const state = useReactive({
    isProcessing: false,
    downloadUrl: undefined as string | undefined,
    error: undefined as string | undefined,
  });

  const playerConfig = useMemo(
    () => ({
      ...(config.player || {}),
      assetBaseUrl:
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_CMS_BASE_URL || "http://127.0.0.1:3000",
    }),
    [config.player]
  );

  /** All script lines from the first processed manuscript. */
  const scriptLines = useMemo(() => {
    const manuscript = processedManuscripts[0];
    if (!manuscript) return [];
    return (manuscript.segments ?? []).flatMap((seg) =>
      (seg.texts ?? []).map((t) => t.text).filter(Boolean)
    );
  }, [processedManuscripts]);

  const downloadAsJsonProject = (title: string) => {
    const data = {
      config,
      manuscripts: tabs.map(({ manuscript }) => manuscript),
      articleUrls: tabs.map(({ articleUrl }) => articleUrl),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const currentTime = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `${title || "videofy-project"}-${currentTime}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const downloadAudio = (title: string) => {
    const firstAudioSrc = processedManuscripts[0]?.meta.audio?.src;
    if (!firstAudioSrc) {
      throw new Error("No narration audio found. Process manuscript first.");
    }

    const a = document.createElement("a");
    a.href = firstAudioSrc;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = `${title || "narration"}.mp3`;
    a.click();
  };

  const renderLocally = async (values: FormType) => {
    state.error = undefined;
    state.isProcessing = true;
    state.downloadUrl = undefined;

    const orientation =
      values.exportType === "Horizontal" ? "horizontal" : "vertical";

    try {
      const response = await fetch("/api/render/local", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: generationId,
          orientation,
          manuscripts: processedManuscripts,
          playerConfig,
          voice: values.audio ? values.voice : false,
          backgroundMusic: values.audio ? values.music : false,
          disabledLogo: !values.logo,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Render failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as { downloadUrl?: string };
      if (!payload.downloadUrl) {
        throw new Error("Render finished but no download URL was returned.");
      }

      state.downloadUrl = payload.downloadUrl;
    } finally {
      state.isProcessing = false;
    }
  };

  const handleDownload = async (values: FormType) => {
    try {
      if (values.exportType === "Videofy Project") {
        downloadAsJsonProject(values.title);
        return;
      }

      if (values.exportType === "Sound only") {
        downloadAudio(values.title);
        return;
      }

      await renderLocally(values);

      if (tabs.length > 0 && generationId) {
        await logAIData(processedManuscripts, generationId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      state.error = message;
      notification.error({
        title: "Tải xuống thất bại",
        description: message,
        duration: 0,
      });
    }
  };

  if (!config) return <div>Lỗi: Không tìm thấy cấu hình.</div>;

  const defaultExportType =
    config.exportDefaults?.exportType &&
    videoTypes.some((t) => t.name === config.exportDefaults?.exportType)
      ? config.exportDefaults.exportType
      : videoTypes[0]?.name;

  return (
    <Modal open={open} onCancel={() => setOpen(false)} footer={null} width={600}>
      <Typography.Title level={2}>Tải xuống</Typography.Title>

      <Form<FormType>
        form={downloadForm}
        onFinish={handleDownload}
        layout="vertical"
        initialValues={{
          title: processedManuscripts[0]?.meta.title || "videofy",
          exportType: defaultExportType,
          logo:
            config.exportDefaults?.logo !== undefined
              ? config.exportDefaults.logo
              : true,
          audio:
            config.exportDefaults?.audio !== undefined
              ? config.exportDefaults.audio
              : true,
          voice:
            config.exportDefaults?.voice !== undefined
              ? config.exportDefaults.voice
              : true,
          music:
            config.exportDefaults?.music !== undefined
              ? config.exportDefaults.music
              : true,
        }}
      >
        <Form.Item name="exportType" label="Loại xuất">
          <Radio.Group
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
            options={videoTypes.map((t) => ({
              value: t.name,
              label: t.description,
            }))}
            optionType="button"
            buttonStyle="solid"
          />
        </Form.Item>

        {/* ── Tiêu đề + nút Copy ── */}
        <Form.Item
          label={
            <Flex align="center" gap={8}>
              <span>Tiêu đề</span>
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => (
                  <CopyButton
                    label="tiêu đề"
                    getValue={() => getFieldValue("title") as string || ""}
                  />
                )}
              </Form.Item>
            </Flex>
          }
          name="title"
        >
          <Input className="w-full" />
        </Form.Item>

        {/* ── Mô tả SEO YouTube ── */}
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const title = (getFieldValue("title") as string) || "";
            const description = buildDescription(title, scriptLines);
            return (
              <div style={{ marginBottom: 24 }}>
                <Flex align="center" justify="space-between" style={{ marginBottom: 4 }}>
                  <Typography.Text strong>Mô tả</Typography.Text>
                  <CopyButton
                    label="mô tả"
                    getValue={() => description}
                  />
                </Flex>
                <Input.TextArea
                  value={description}
                  readOnly
                  autoSize={{ minRows: 6, maxRows: 12 }}
                  style={{ resize: "none" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Mô tả chuẩn SEO YouTube — sao chép và dán vào phần mô tả video.
                </Typography.Text>
              </div>
            );
          }}
        </Form.Item>

        {/* ── Tags SEO YouTube ── */}
        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const title = (getFieldValue("title") as string) || "";
            const tags = buildTags(title, scriptLines);
            const tagsString = tags.join(", ");
            return (
              <div style={{ marginBottom: 24 }}>
                <Flex align="center" justify="space-between" style={{ marginBottom: 4 }}>
                  <Typography.Text strong>Tags YouTube</Typography.Text>
                  <CopyButton
                    label="tags"
                    getValue={() => tagsString}
                  />
                </Flex>
                <Input.TextArea
                  value={tagsString}
                  readOnly
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  style={{ resize: "none" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Các thẻ cách nhau bằng dấu phẩy — sao chép và dán vào phần Tags của YouTube Studio.
                </Typography.Text>
              </div>
            );
          }}
        </Form.Item>

        {/* ── Switches ── */}
        <Flex gap="middle">
          <Form.Item label="Logo" name="logo" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Âm thanh" name="audio" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Giọng đọc" name="voice" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Nhạc nền" name="music" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Flex>

        {/* ── Submit + Download ── */}
        <Flex gap="middle">
          <Form.Item shouldUpdate>
            {({ getFieldValue }) => {
              const exportType = getFieldValue("exportType");
              let buttonText = "Xử lý video";
              if (exportType === "Videofy Project") {
                buttonText = "Tải xuống";
              } else if (exportType === "Sound only") {
                buttonText = "Tải âm thanh";
              } else if (state.isProcessing) {
                buttonText = "Đang render...";
              } else if (state.downloadUrl) {
                buttonText = "Render lại";
              }

              return (
                <Button
                  type={state.downloadUrl ? "default" : "primary"}
                  htmlType="submit"
                  size="large"
                  disabled={state.isProcessing}
                  icon={state.isProcessing ? <LoadingOutlined spin /> : undefined}
                >
                  {buttonText}
                </Button>
              );
            }}
          </Form.Item>
          {state.downloadUrl && (
            <Form.Item>
              <Button
                href={state.downloadUrl}
                target="_blank"
                rel="noreferrer"
                type="primary"
                size="large"
              >
                Tải video về
              </Button>
            </Form.Item>
          )}
        </Flex>

        {state.error && <Alert type="error" message={`Lỗi: ${state.error}`} />}
      </Form>
    </Modal>
  );
};

export default DownloadModal;
