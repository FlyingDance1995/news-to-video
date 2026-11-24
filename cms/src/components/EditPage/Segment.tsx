"use client";
import { Bars3Icon } from "@heroicons/react/20/solid";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Tooltip,
} from "antd";
import { CopyOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { cameraMovements, moods, textPlacements } from "@/utils/constants";
import { FC } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MediaAsset from "./MediaAsset";
import AudioRecorder from "../AudioRecorder/AudioRecorder";

interface SegmentProps {
  id: string;
  position: number;
  onDuplicate: () => void;
  onRemove: () => void;
  onAdd: () => void;
  manuscriptIndex: number;
}

const Segment: FC<SegmentProps> = ({
  id,
  manuscriptIndex,
  position,
  onAdd,
  onDuplicate,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: "100%",
  };

  const form = Form.useFormInstance();
  const allMedia = form.getFieldValue([
    "tabs",
    manuscriptIndex,
    "manuscript",
    "media",
  ]);

  const originalText: string | undefined = form.getFieldValue([
    "tabs",
    manuscriptIndex,
    "manuscript",
    "segments",
    position,
    "texts",
    0,
    "text",
  ]);

  const vietnameseText: string | undefined =
    form.getFieldValue([
      "tabs",
      manuscriptIndex,
      "manuscript",
      "segments",
      position,
      "texts",
      0,
      "vietnameseText",
    ]) || undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <Card key={id} className="w-full" styles={{ body: { padding: "12px 16px" } }}>
        <Row gutter={12} wrap={false} align="stretch">

          {/* ── Cột 1: drag handle ── */}
          <Col flex="20px">
            <Flex
              vertical
              justify="center"
              align="center"
              style={{ height: "100%", cursor: "move" }}
              {...attributes}
              {...listeners}
            >
              <Bars3Icon className="w-4 h-4 dark:text-gray-100" aria-hidden="true" />
            </Flex>
          </Col>

          {/* ── Cột 2: media ── */}
          <Col flex="200px">
            <Form.Item name={[position, "mainMedia"]} style={{ margin: 0 }}>
              <MediaAsset allMedia={allMedia} />
            </Form.Item>
          </Col>

          {/* ── Cột 3: nội dung chính ── */}
          <Col flex="auto">
            <Flex vertical style={{ height: "100%" }}>

              {/* Textarea + bản gốc */}
              <Form.Item style={{ marginBottom: 6, flex: 1 }}>
                <Form.Item noStyle name={[position, "text"]}>
                  <Input.TextArea style={{ width: "100%" }} rows={4} />
                </Form.Item>
                {(vietnameseText || originalText) && (
                  <div
                    className="mt-1 px-3 py-2 rounded text-[12px] border"
                    style={{
                      lineHeight: "1.5",
                      backgroundColor: "var(--ant-color-bg-container-disabled, #f5f5f5)",
                      borderColor: "var(--ant-color-border, #d9d9d9)",
                      color: "var(--ant-color-text-secondary, #666)",
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide block mb-0.5"
                      style={{ color: "var(--ant-color-text-quaternary, #aaa)" }}
                    >
                      {vietnameseText ? "Tiếng Việt" : "Bản gốc"}
                    </span>
                    {vietnameseText || originalText}
                  </div>
                )}
                <div
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--ant-color-text-quaternary, #aaa)" }}
                >
                  Thêm gợi ý phát âm trong [ngoặc vuông] sau từ
                </div>
              </Form.Item>

              {/* Controls: 3 select + âm thanh tùy chỉnh */}
              <Row gutter={8} align="bottom" style={{ marginBottom: 0 }}>
                <Col span={6}>
                  <Form.Item label="Tâm trạng" name={[position, "mood"]} style={{ marginBottom: 0 }}>
                    <Select
                      size="small"
                      options={moods.map((m) => ({ value: m.id, label: m.name }))}
                      popupMatchSelectWidth={false}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Camera" name={[position, "cameraMovement"]} style={{ marginBottom: 0 }}>
                    <Select
                      size="small"
                      options={cameraMovements.map((c) => ({ value: c.id, label: c.name }))}
                      popupMatchSelectWidth={false}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Vị trí chữ" name={[position, "style"]} style={{ marginBottom: 0 }}>
                    <Select
                      size="small"
                      options={textPlacements.map((c) => ({ value: c.id, label: c.name }))}
                      popupMatchSelectWidth={false}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name={[position, "customAudio"]}
                    label="Âm thanh"
                    style={{ marginBottom: 0 }}
                  >
                    <AudioRecorder size="small" />
                  </Form.Item>
                </Col>
              </Row>

            </Flex>
          </Col>

          {/* ── Cột 4: action buttons ── */}
          <Col flex="36px">
            <Flex vertical gap={6} align="center" justify="flex-start" style={{ height: "100%" }}>
              <Tooltip title="Thêm đoạn bên dưới">
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAdd} />
              </Tooltip>
              <Tooltip title="Nhân đôi đoạn">
                <Button size="small" type="primary" icon={<CopyOutlined />} onClick={onDuplicate} />
              </Tooltip>
              <Tooltip title="Xóa đoạn">
                <Button size="small" danger type="primary" icon={<DeleteOutlined />} onClick={onRemove} />
              </Tooltip>
            </Flex>
          </Col>

        </Row>
      </Card>
    </div>
  );
};

export default Segment;
