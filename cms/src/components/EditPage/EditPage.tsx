"use client";

import { type FC, useEffect } from "react";
import { useReactive } from "ahooks";
import { useParams } from "next/navigation";
import { Tab, useGlobalState } from "@/state/globalState";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Flex, Form, Spin, Tooltip, Typography } from "antd";
import { SettingOutlined, ShareAltOutlined } from "@ant-design/icons";
import PreviewOutput from "./Preview/PreviewOutput";
import SortableTabs from "../SortableTabs";
import SegmentList from "./SegmentList";
import EditConfig from "./EditConfig";
import AddFetchedArticle from "./AddFetchedArticle";

const EditPage: FC = () => {
  const {
    config,
    tabs,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    generationId,
  } = useGlobalState();
  const router = useRouter();
  const params = useParams();
  const { message, notification } = App.useApp();
  const state = useReactive({
    editTheme: false,
    selectedTab: tabs[0]?.manuscript.meta.uniqueId,
    manuscript: tabs,
    loadingGeneration: true,
    loadError: null as string | null,
    openArticleModal: false,
    brandId: "default",
  });

  useEffect(() => {
    const generationParam = params.generation;
    const generationId = Array.isArray(generationParam)
      ? generationParam[0]
      : generationParam;
    if (!generationId) {
      state.loadingGeneration = false;
      router.replace("/");
      return;
    }
    const fetchGeneration = async () => {
      state.loadingGeneration = true;
      state.loadError = null;
      try {
        const response = await fetch(
          `/api/generations?id=${encodeURIComponent(String(generationId))}`
        );
        if (response.status === 404) {
          notification.warning({
            title: "Dự án không còn tồn tại",
            description: "Generation đã bị xóa hoặc thư mục dự án không còn.",
          });
          router.replace("/");
          return;
        }
        if (!response.ok) {
          throw new Error("Không thể tải generation");
        }
        const generation = await response.json();
        if (!generation.config || !generation.projectId) {
          throw new Error("Dữ liệu generation thiếu config hoặc projectId");
        }
        setConfig({
          projectId: generation.projectId,
          config: generation.config,
        });
        setTabs(generation.data);
        setSelectedProject(
          generation.project || {
            id: generation.projectId,
            name: generation.projectId,
          }
        );
        setGenerationId(generation.id);
        state.brandId = generation.brandId || "default";
        state.selectedTab = generation.data?.[0]?.manuscript?.meta?.uniqueId;
      } catch (error) {
        console.error(error);
        state.loadError =
          error instanceof Error ? error.message : "Không thể tải generation";
      } finally {
        state.loadingGeneration = false;
      }
    };
    void fetchGeneration();
  }, [
    params,
    router,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    notification,
    state,
  ]);

  useEffect(() => {
    if (!state.selectedTab && tabs.length > 0) {
      state.selectedTab = tabs[0]?.manuscript.meta.uniqueId;
    }
  }, [state, tabs]);

  const [form] = Form.useForm();

  const handleAddArticle = async (tab: Tab) => {
    const currentTabs = (form.getFieldValue("tabs") || []) as Tab[];
    const nextTabs = [...currentTabs, tab];
    form.setFieldValue("tabs", nextTabs);
    setTabs(nextTabs);
    state.selectedTab = tab.manuscript.meta.uniqueId;

    const idFromParams = Array.isArray(params.generation)
      ? params.generation[0]
      : params.generation;
    const persistId = generationId || String(idFromParams || "");
    if (!persistId) {
      return;
    }
    const response = await fetch("/api/generations", {
      method: "PUT",
      body: JSON.stringify({
        id: persistId,
        data: nextTabs,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to persist generation after adding article");
    }
  };

  if (state.loadingGeneration || !config) {
    return (
      <Flex vertical align="center" justify="center" className="p-8">
        {state.loadError ? (
          <Alert
            type="error"
            message="Không thể tải dự án"
            description={state.loadError}
            action={
              <Button type="primary" onClick={() => router.replace("/")}>
                Quay lại trang chủ
              </Button>
            }
          />
        ) : (
          <Flex vertical align="center" gap="small">
            <Spin />
            <Typography.Text>Đang tải dự án...</Typography.Text>
          </Flex>
        )}
      </Flex>
    );
  }

  return (
    <Form
      preserve
      initialValues={{ tabs, config }}
      layout="vertical"
      form={form}
      style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Header */}
      <Flex className="justify-between items-center px-4 py-2 border-b border-gray-200">
        <Typography.Title
          level={5}
          className="cursor-pointer !mb-0"
          onClick={() => {
            router.push(`/`);
          }}
        >
          Videofy
        </Typography.Title>
        <Flex gap="small">
          <Tooltip title="Chia sẻ video">
            <Button
              icon={<ShareAltOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                message.success("Đã sao chép URL video vào clipboard.", 5);
              }}
            >
              Chia sẻ
            </Button>
          </Tooltip>
          <Tooltip title="Chỉnh sửa giao diện">
            <Button
              type={state.editTheme ? "primary" : "default"}
              icon={<SettingOutlined />}
              onClick={() => (state.editTheme = !state.editTheme)}
            />
          </Tooltip>
        </Flex>
      </Flex>

      {/* Main: 2 cột, chiều cao = viewport trừ header, không scroll ngoài */}
      <div style={{ display: "flex", height: "calc(100dvh - 49px)", overflow: "hidden" }}>

        {/* Cột trái — preview neo top, không scroll */}
        <div style={{ flex: "0 0 40%", padding: "16px", overflowY: "hidden", display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", alignSelf: "flex-start", maxHeight: "calc(100dvh - 49px)" }}>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldsValue }) => {
              const manuscripts = getFieldsValue(true).tabs;
              return <PreviewOutput tabs={manuscripts} />;
            }}
          </Form.Item>
        </div>

        {/* Cột phải — tab bar neo top, chỉ phần content scroll */}
        <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", borderLeft: "1px solid #f0f0f0", overflow: "hidden" }}>
          {!state.editTheme ? (
            <Form.List name={["tabs"]}>
              {(tabItems, { move }) => {
                return (
                  <SortableTabs
                    allowAdd
                    onAdd={() => {
                      state.openArticleModal = true;
                    }}
                    activeKey={state.selectedTab}
                    onChange={(value) => {
                      state.selectedTab = value;
                    }}
                    onReorder={(from, to) => {
                      move(from, to);
                    }}
                    items={tabItems.map((t) => {
                      const tab = form.getFieldValue(["tabs", t.name]);
                      return {
                        key: tab.manuscript.meta.uniqueId!,
                        label: (
                          <Flex align="center">
                            <Typography.Paragraph
                              ellipsis={{
                                tooltip: tab.manuscript.meta.title,
                              }}
                              style={{
                                maxWidth: 250,
                                marginBottom: 0,
                                userSelect: "none",
                              }}
                            >
                              {tab.manuscript.meta.title}
                            </Typography.Paragraph>
                          </Flex>
                        ),
                        children: (
                          <SegmentList
                            index={t.name}
                            manuscript={tab.manuscript}
                          />
                        ),
                        forceRender: true,
                      };
                    })}
                  />
                );
              }}
            </Form.List>
          ) : (
            <Form.Item name="config" noStyle>
              <EditConfig />
            </Form.Item>
          )}
        </div>
      </div>

      <AddFetchedArticle
        open={state.openArticleModal}
        setOpen={(open) => {
          state.openArticleModal = open;
        }}
        brandId={state.brandId}
        onChange={handleAddArticle}
      />
    </Form>
  );
};

export default EditPage;
