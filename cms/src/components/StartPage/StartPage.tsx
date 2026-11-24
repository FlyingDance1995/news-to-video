"use client";
import { useEffect, useMemo, useRef } from "react";
import { useReactive } from "ahooks";
import { generateManuscript } from "@/utils/generateManuscript";
import { useGlobalState } from "@/state/globalState";
import { Config } from "@videofy/types";
import Cookies from "universal-cookie";
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Radio,
  Select,
  Spin,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import {
  getBrands,
  getConfigs,
  getProjects,
  runFetcherPlugin,
  setProjectBrand,
  useBrands,
  useFetchers,
} from "@/api";
import { LoadingOutlined } from "@ant-design/icons";

const PROMPT_LONG = `You are a journalist writing voice scripts for SoMe videos summarising the daily news. You will receive a news article in the user input. Lets do this step by step: \n 1: Read the article and understand what the article is about \n 2: Note the key points that are important for the reader to undersand. What is new, surprising or interesting? \n 3: Summarize these points in a way that is factual, but also engaging and informative. Go straigt to the content of the article, no welcome/padding text. \n 4: The script should be in American and consist of content lasting approximately 2 to 10 minutes. Each 1 or 2 sentences correspond to a single frame or a short video clip lasting less than 4 seconds, sourced from relevant content found on social media or in news outlets that pertains to those sentences.. \n 5: The last line should offer some form of completion or conclusion to the article. Make sure that all major perspectives are corectly represented in the script.\n 6: Then rewrite each line so it is a gramatically correct, punchy. Make sure the sentence uses simple words so it is easy to read for the voice actor. \n 7: Do not include encodings or special characters that can not be pronounced by the voice actor.`;

const PROMPT_SHORT = `You are a journalist writing voice scripts for SoMe videos summarising the daily news. You will receive a news article in the user input. Lets do this step by step: \n 1: Read the article and understand what the article is about \n 2: Note the key points that are important for the reader to undersand. What is new, surprising or interesting? \n 3: Summarize these points in a way that is factual, but also engaging and informative. Go straigt to the content of the article, no welcome/padding text. \n 4: The script should be in American and consist of no more than 3 lines of text. Each line should give the readers new and relevant information about the article. \n 5: The last line should offer some form of completion or conclusion to the article. Make sure that all major perspectives are corectly represented in the script.\n 6: Then rewrite each line so it is a gramatically correct, punchy and engaging sentence of max 12 words. Make sure the sentence uses simple words so it is easy to read for the voice actor. \n 7: Do not include encodings or special characters that can not be pronounced by the voice actor.`;

const { Title, Paragraph } = Typography;
const cookies = new Cookies();

type FormType = {
  fetcherId: string;
  brandId: string;
  prompt: string;
  videoType: "long" | "short";
  inputs: Record<string, string>;
};

const StartPage = () => {
  const { data: fetchers, isLoading: loadingFetchers } = useFetchers();
  const { data: brands, isLoading: loadingBrands } = useBrands();
  const hasFetchers = Boolean(fetchers && fetchers.length > 0);
  const hasBrands = Boolean(brands && brands.length > 0);

  const state = useReactive({
    loading: false,
    loadingMessage: "Đang tạo video...",
  });
  const { notification } = App.useApp();
  const {
    setConfig,
    setCustomPrompt,
    setTabs,
    setCurrentTabIndex,
    setGenerationId,
    setSelectedProject,
  } = useGlobalState();

  const [form] = Form.useForm<FormType>();
  const selectedFetcherId = Form.useWatch("fetcherId", form);
  const selectedBrandId = Form.useWatch("brandId", form);
  const selectedVideoType = Form.useWatch("videoType", form);
  const selectedFetcher = useMemo(
    () => fetchers?.find((fetcher) => fetcher.id === selectedFetcherId),
    [fetchers, selectedFetcherId]
  );
  const selectedFetcherFields = useMemo(
    () =>
      (selectedFetcher?.fields || []).filter((field) => field.name !== "project_id"),
    [selectedFetcher]
  );
  const selectedBrand = useMemo(
    () => brands?.find((brand) => brand.id === selectedBrandId),
    [brands, selectedBrandId]
  );
  const lastSyncedBrandId = useRef<string | undefined>(undefined);

  const router = useRouter();

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
    if (!brands || brands.length === 0) {
      return;
    }
    const currentBrandId = form.getFieldValue("brandId");
    if (currentBrandId) {
      return;
    }
    const initialBrand = brands[0];
    form.setFieldsValue({
      brandId: initialBrand.id,
      prompt: PROMPT_LONG,
      videoType: "long" as const,
    });
  }, [brands, form]);

  useEffect(() => {
    if (!brands || brands.length === 0 || !selectedBrandId) {
      return;
    }
    if (lastSyncedBrandId.current === selectedBrandId) {
      return;
    }
    const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);
    if (!selectedBrand) {
      return;
    }
    const nextPrompt = selectedBrand.scriptPrompt || "";
    const currentPrompt = form.getFieldValue("prompt") || "";
    if (nextPrompt !== currentPrompt) {
      form.setFields([{ name: "prompt", value: nextPrompt }]);
    }
    lastSyncedBrandId.current = selectedBrandId;
  }, [brands, form, selectedBrandId]);

  useEffect(() => {
    if (!selectedFetcherId) {
      return;
    }
    form.setFieldValue("inputs", {});
  }, [selectedFetcherId, form]);

  // Swap prompt khi đổi loại video
  useEffect(() => {
    if (!selectedVideoType) return;
    const nextPrompt = selectedVideoType === "long" ? PROMPT_LONG : PROMPT_SHORT;
    form.setFieldValue("prompt", nextPrompt);
  }, [selectedVideoType, form]);

  const loadManuscript = async (values: FormType) => {
    const { prompt, fetcherId, brandId } = values;
    const customPrompt = (prompt || "").trim();
    const selected = fetchers?.find((fetcher) => fetcher.id === fetcherId);
    if (!selected) {
      notification.error({ title: "Fetcher not found." });
      return;
    }
    const brand =
      brands?.find((item) => item.id === brandId) ||
      (await getBrands()).find((item) => item.id === brandId);
    if (!brand) {
      notification.error({ title: "Brand not found." });
      return;
    }
    state.loading = true;
    state.loadingMessage = "Đang tải bài viết...";
    try {
      const fetchResult = await runFetcherPlugin({
        fetcherId,
        inputs: values.inputs || {},
      });

      state.loadingMessage = "Đang áp dụng cài đặt thương hiệu...";
      await setProjectBrand(fetchResult.projectId, brand.id);

      state.loadingMessage = "Đang tải cấu hình dự án...";
      const [projects, configs] = await Promise.all([getProjects(), getConfigs()]);
      const project = projects.find((p) => p.id === fetchResult.projectId) || {
        id: fetchResult.projectId,
        name: fetchResult.projectId,
      };
      setSelectedProject(project);

      const configRow = configs.find((c) => c.projectId === fetchResult.projectId);
      const config = configRow?.config;
      if (!configRow || !config) {
        throw new Error(`Config not found for project '${fetchResult.projectId}'`);
      }

      const customizedConfig: Config = {
        ...config,
        manuscript: {
          ...config.manuscript,
          script_prompt: customPrompt || config.manuscript.script_prompt,
        },
      };

      setConfig({ ...configRow, config: customizedConfig });

      state.loadingMessage = "Đang tạo kịch bản...";
      const manuscript = await generateManuscript(fetchResult.projectId, customizedConfig);

      if (!manuscript) {
        throw new Error("Backend did not return a manuscript");
      }

      const cleanedManuscript = {
        ...manuscript,
        meta: {
          ...manuscript.meta,
          articleUrl: fetchResult.projectId,
          uniqueId: crypto.randomUUID(),
        },
      };

      const tabsData = [
        {
          articleUrl: fetchResult.projectId,
          projectId: fetchResult.projectId,
          manuscript: cleanedManuscript,
        },
      ];
      setTabs(tabsData);
      setCustomPrompt(customPrompt);
      setCurrentTabIndex(0);

      const response = await fetch("/api/generations", {
        method: "POST",
        body: JSON.stringify({
          projectId: fetchResult.projectId,
          brandId: brand.id,
          config: customizedConfig,
          project,
          data: tabsData,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create generation");
      }
      const { id: generationId } = await response.json();

      setGenerationId(generationId);
      cookies.set("projectId", fetchResult.projectId);

      router.push(`/${encodeURIComponent(generationId)}`);
    } catch (error) {
      if (error instanceof Error) {
        notification.error({ title: error.message, duration: 0 });
      } else {
        notification.error({ title: "Không thể tải bài viết", duration: 0 });
      }
    } finally {
      state.loading = false;
      state.loadingMessage = "Đang tạo video...";
    }
  };

  if (loadingFetchers || loadingBrands) {
    return (
      <Spin description="Đang tải dữ liệu..." fullscreen delay={500} />
    );
  }

  return (
    <Flex vertical gap="middle" align="center" className="mt-4 mb-4">
      <Title style={{ fontSize: 60, marginBottom: 10, marginTop: 40 }}>
        Videofy
      </Title>
      <Paragraph style={{ marginBottom: 36 }}>
        Chọn nguồn tin, nhập thông tin và tạo video.
      </Paragraph>
      <Card style={{ width: "100%", maxWidth: "80ch" }}>
        {!hasFetchers && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Không tìm thấy nguồn tin"
            description="Thêm fetcher vào minimal/fetchers/<fetcherId>/fetcher.json rồi tải lại trang."
          />
        )}
        {!hasBrands && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Không tìm thấy thương hiệu"
            description="Thêm file JSON thương hiệu vào minimal/brands/ rồi tải lại trang."
          />
        )}
        <Form form={form} onFinish={loadManuscript} layout="vertical">
          <Form.Item name="fetcherId" label="Nguồn tin" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              disabled={!hasFetchers}
              options={fetchers?.map((fetcher) => ({
                value: fetcher.id,
                label: fetcher.title,
              }))}
            />
          </Form.Item>
          {selectedFetcher && selectedFetcher.description && (
            <Paragraph type="secondary" style={{ marginTop: -8 }}>
              {selectedFetcher.description}
            </Paragraph>
          )}
          {selectedFetcherFields.map((field) => (
            <Form.Item
              key={field.name}
              name={["inputs", field.name]}
              label={field.label}
              preserve={false}
              rules={
                field.required
                  ? [{ required: true, message: `${field.label} is required` }]
                  : undefined
              }
            >
              <Input placeholder={field.placeholder} />
            </Form.Item>
          ))}
          <Form.Item name="brandId" label="Thương hiệu" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              disabled={!hasBrands}
              options={brands?.map((brand) => ({
                value: brand.id,
                label: brand.brandName,
              }))}
            />
          </Form.Item>
          <Form.Item noStyle>
            <Form.Item
              name="videoType"
              label="Độ dài video"
              style={{ marginBottom: 8 }}
            >
              <Radio.Group>
                <Radio.Button value="long">🎬 Video dài (2–10 phút)</Radio.Button>
                <Radio.Button value="short">⚡ Video ngắn (3 dòng)</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="Prompt tùy chỉnh"
              name="prompt"
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea rows={10} />
            </Form.Item>
          </Form.Item>
          {selectedBrand ? (
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              Nguồn prompt: {selectedBrand.brandName}
            </Paragraph>
          ) : null}
          <Form.Item style={{ marginTop: 16 }}>
            {state.loading ? (
              <Button
                type="primary"
                size="large"
                icon={<LoadingOutlined spin />}
                disabled
              >
                {state.loadingMessage}
              </Button>
            ) : (
              <Button
                htmlType="submit"
                type="primary"
                size="large"
                disabled={!hasFetchers || !hasBrands}
              >
                Tạo video
              </Button>
            )}
          </Form.Item>
        </Form>
      </Card>
    </Flex>
  );
};

export default StartPage;
