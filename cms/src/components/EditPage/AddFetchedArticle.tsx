"use client";

import { useEffect, useMemo, type FC } from "react";
import { useReactive } from "ahooks";
import { App, Button, Form, Input, Modal, Select, Spin, Typography } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { runFetcherPlugin, setProjectBrand, useFetchers } from "@/api";
import { generateManuscript } from "@/utils/generateManuscript";
import { Tab, useGlobalState } from "@/state/globalState";

type FormType = {
  fetcherId: string;
  inputs: Record<string, string>;
};

type AddFetchedArticleProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  brandId: string;
  onChange: (tab: Tab) => Promise<void>;
};

const AddFetchedArticle: FC<AddFetchedArticleProps> = ({
  open,
  setOpen,
  brandId,
  onChange,
}) => {
  const [form] = Form.useForm<FormType>();
  const { data: fetchers, isLoading: loadingFetchers } = useFetchers();
  const { config } = useGlobalState();
  const { notification } = App.useApp();

  const state = useReactive({
    loading: false,
    loadingMessage: "Đang tải bài viết...",
  });

  const selectedFetcherId = Form.useWatch("fetcherId", form);
  const selectedFetcher = useMemo(
    () => fetchers?.find((fetcher) => fetcher.id === selectedFetcherId),
    [fetchers, selectedFetcherId]
  );
  const fields = useMemo(
    () =>
      (selectedFetcher?.fields || []).filter((field) => field.name !== "project_id"),
    [selectedFetcher]
  );

  useEffect(() => {
    if (!fetchers || fetchers.length === 0) {
      return;
    }
    const currentFetcherId = form.getFieldValue("fetcherId");
    if (currentFetcherId) {
      return;
    }
    form.setFieldsValue({
      fetcherId: fetchers[0].id,
      inputs: {},
    });
  }, [fetchers, form]);

  useEffect(() => {
    if (!selectedFetcherId) {
      return;
    }
    form.setFieldValue("inputs", {});
  }, [selectedFetcherId, form]);

  const handleClose = () => {
    if (state.loading) {
      return;
    }
    setOpen(false);
    form.resetFields();
  };

  const handleAddArticle = async (values: FormType) => {
    if (!config?.config) {
      notification.error({ title: "Cấu hình chưa được tải." });
      return;
    }
    state.loading = true;
    state.loadingMessage = "Đang tải bài viết...";
    try {
      const fetchResult = await runFetcherPlugin({
        fetcherId: values.fetcherId,
        inputs: values.inputs || {},
      });

      state.loadingMessage = "Đang áp dụng cài đặt thương hiệu...";
      await setProjectBrand(fetchResult.projectId, brandId || "default");

      state.loadingMessage = "Đang tạo kịch bản...";
      const manuscript = await generateManuscript(fetchResult.projectId, config.config);
      const cleanedManuscript = {
        ...manuscript,
        meta: {
          ...manuscript.meta,
          articleUrl: fetchResult.projectId,
          uniqueId: crypto.randomUUID(),
        },
      };

      await onChange({
        articleUrl: fetchResult.projectId,
        projectId: fetchResult.projectId,
        manuscript: cleanedManuscript,
      });

      setOpen(false);
      form.resetFields();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể thêm bài viết";
      notification.error({ title: message, duration: 0 });
    } finally {
      state.loading = false;
      state.loadingMessage = "Đang tải bài viết...";
    }
  };

  return (
    <Modal
      title="Thêm bài viết"
      open={open}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={state.loading}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={state.loading ? <LoadingOutlined spin /> : undefined}
          onClick={() => form.submit()}
          disabled={loadingFetchers}
        >
          {state.loading ? state.loadingMessage : "Thêm bài viết"}
        </Button>,
      ]}
    >
      {loadingFetchers ? (
        <Spin description="Đang tải nguồn tin..." />
      ) : (
        <Form form={form} layout="vertical" onFinish={handleAddArticle}>
          <Form.Item name="fetcherId" label="Nguồn tin" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={fetchers?.map((fetcher) => ({
                value: fetcher.id,
                label: fetcher.title,
              }))}
            />
          </Form.Item>
          {selectedFetcher?.description ? (
            <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
              {selectedFetcher.description}
            </Typography.Paragraph>
          ) : null}
          {fields.map((field) => (
            <Form.Item
              key={field.name}
              name={["inputs", field.name]}
              label={field.label}
              preserve={false}
              rules={
                field.required
                  ? [{ required: true, message: `${field.label} là bắt buộc` }]
                  : undefined
              }
            >
              <Input placeholder={field.placeholder} />
            </Form.Item>
          ))}
        </Form>
      )}
    </Modal>
  );
};

export default AddFetchedArticle;
