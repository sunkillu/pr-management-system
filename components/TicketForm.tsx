"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { roleLabels, coopTypeLabels, PLATFORM_TAG_OPTIONS, STYLE_OPTIONS, COOP_CATEGORY_OPTIONS, ticketKindLabels } from "@/lib/labels";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { OccupancyWarning } from "./OccupancyWarning";
import ShipItemEditor from "./ShipItemEditor";
import type { ShipItem } from "@/lib/ship-items";
import { InfluencerHistory } from "./InfluencerHistory";
import type { OccupancyInfo } from "@/lib/occupancy";

type Approver = { id: string; name: string; email: string; role: string };
type Partner = { id: string; name: string; homepageId?: string | null };
type Attachment = { fileUrl: string; fileName: string };

const isImage = (name: string) => /\.(jpe?g|png|webp|gif)$/i.test(name);

export type EditTicketData = {
  id: string;
  title: string;
  type: string;
  brandId: string;
  platform: string[];
  style: string[];
  budgetFee: string;
  note: string;
  contentDirection: string;
  priceNote: string;
  contentNote: string;
  estimatedSchedule: string;
  estimatedPublishMonth: string;
  quoteAmount: string;
  confirmedDate: string;
  coopCategory: string[];
  homepageId: string;
  startDate: string;
  endDate: string;
  influencerId: string | null;
  makeupArtistId: string | null;
};

export default function TicketForm({
  influencers,
  makeupArtists,
  initialInfluencerId,
  initialMakeupArtistId,
  initialCoopRequestId,
  editTicket,
  userRole,
  autoOpen = false,
}: {
  influencers: Partner[];
  makeupArtists: Partner[];
  initialInfluencerId?: string;
  initialMakeupArtistId?: string;
  initialCoopRequestId?: string;
  editTicket?: EditTicketData;
  userRole?: string;
  autoOpen?: boolean;
}) {
  const isEdit = !!editTicket;
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  // 工单类型：运营只能发起采买工单；从采买工单转来时固定为合作工单
  const isOperator = userRole === "OPERATOR";
  const [ticketKind, setTicketKind] = useState<"COOPERATION" | "PROCUREMENT" | "MAINTENANCE">(
    isOperator ? "PROCUREMENT" : "COOPERATION"
  );
  // 采买请求：动态行列表，每行 = 款式 + 数量；参考链接全局一个（选填）
  const [procurementItems, setProcurementItems] = useState<{ style: string; quantity: string }[]>([{ style: "", quantity: "" }]);
  const [procurementLink, setProcurementLink] = useState("");
  const [title, setTitle] = useState(editTicket?.title ?? "");
  const [note, setNote] = useState(editTicket?.note ?? "");
  const [budgetFee, setBudgetFee] = useState(editTicket?.budgetFee ?? "");
  const [styles, setStyles] = useState<string[]>(editTicket?.style ?? []);
  const [contentDirection, setContentDirection] = useState(editTicket?.contentDirection ?? "");
  const [type, setType] = useState(editTicket?.type ?? (initialMakeupArtistId ? "MAKEUP" : "INFLUENCER_POST"));
  const [partnerId, setPartnerId] = useState(editTicket?.influencerId ?? editTicket?.makeupArtistId ?? initialInfluencerId ?? initialMakeupArtistId ?? "");
  const [startDate, setStartDate] = useState(editTicket?.startDate ?? "");
  const [endDate, setEndDate] = useState(editTicket?.endDate ?? "");
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string }[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  // 品牌：单选必填
  const [brandId, setBrandId] = useState(editTicket?.brandId ?? "");
  const [brandOptions, setBrandOptions] = useState<{ id: string; name: string }[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(editTicket?.platform ?? []);
  const [homepageId, setHomepageId] = useState(editTicket?.homepageId ?? "");
  const [coopCategories, setCoopCategories] = useState<string[]>(editTicket?.coopCategory ?? []);
  const [priceNote, setPriceNote] = useState(editTicket?.priceNote ?? "");
  const [contentNote, setContentNote] = useState(editTicket?.contentNote ?? "");
  const [estimatedSchedule, setEstimatedSchedule] = useState(editTicket?.estimatedSchedule ?? "");
  const [confirmSchedule, setConfirmSchedule] = useState(!!editTicket?.confirmedDate);
  const [confirmedDate, setConfirmedDate] = useState(editTicket?.confirmedDate ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // 寄品明细：可寄多个款式，每行 {款式、度数、抛期、盒数、寄品备注}
  const [shipItems, setShipItems] = useState<ShipItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  // v2: 达人资源占用警示
  const [occupancy, setOccupancy] = useState<OccupancyInfo | null>(null);
  useEffect(() => {
    if (ticketKind !== "COOPERATION" || type === "MAKEUP" || !partnerId || !open) {
      setOccupancy(null);
      return;
    }
    fetch(`/api/occupancy?influencerId=${partnerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOccupancy(d && typeof d.occupied === "boolean" ? d : null))
      .catch(() => setOccupancy(null));
  }, [partnerId, ticketKind, type, open]);

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "插图上传失败");
      return;
    }
    setAttachments((a) => [...a, { fileUrl: data.fileUrl, fileName: data.fileName }]);
  }

  useEffect(() => {
    if (open) {
      fetch("/api/approvers?roles=PR_MANAGER,ADMIN")
        .then((r) => r.json())
        .then((d) => setApprovers(Array.isArray(d) ? d : []))
        .catch(() => setApprovers([]));
      fetch("/api/tags?categoryKey=TICKET")
        .then((r) => r.json())
        .then((d) => setTagOptions(Array.isArray(d) ? d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : []))
        .catch(() => setTagOptions([]));
      fetch("/api/brands?active=1")
        .then((r) => r.json())
        .then((d) => setBrandOptions(Array.isArray(d) ? d : []))
        .catch(() => setBrandOptions([]));
    }
  }, [open ]);

  const partners = type === "MAKEUP" ? makeupArtists : influencers;

  // 从需求跳转带入达人时，自动带入主页ID
  useEffect(() => {
    if (initialInfluencerId) {
      const p = influencers.find((x) => x.id === initialInfluencerId);
      if (p?.homepageId) setHomepageId(p.homepageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPartnerChange(id: string) {
    setPartnerId(id);
    // 选达人时从达人库自动带入主页ID，可手动改
    if (type !== "MAKEUP") {
      const p = influencers.find((x) => x.id === id);
      if (p?.homepageId) setHomepageId(p.homepageId);
    }
  }

  async function validate(): Promise<string | null> {
    if (!brandId) return "请选择所属品牌";
    // 采买工单：只保留品牌 / 平台 / 参考链接 / 采买请求列表（标题走 __AUTO__，无预算/素材类型/子类型）
    if (ticketKind === "PROCUREMENT" && !isEdit) {
      if (platforms.length === 0) return "请选择合作平台（可多选）";
      if (procurementItems.length === 0) return "请至少添加一行采买请求";
      for (let i = 0; i < procurementItems.length; i++) {
        if (!procurementItems[i].style) return `第 ${i + 1} 行请选择款式`;
        if (!/^[1-9]\d*$/.test(procurementItems[i].quantity.trim())) return `第 ${i + 1} 行数量必须为正整数`;
      }
      return null;
    }
    // 维护工单：只校验品牌、合作对象、平台、款式（无预算/档期/报价/采买字段）
    if (ticketKind === "MAINTENANCE" && !isEdit) {
      if (!partnerId) return "请选择合作对象";
      if (platforms.length === 0) return "请选择合作平台（可多选）";
      if (styles.length === 0) return "请选择款式（可多选）";
      return null;
    }
    if (!budgetFee || Number(budgetFee) <= 0) return "预算费用必须大于 0";
    // 合作工单：原有校验
    if (!partnerId) return "请选择合作对象";
    if (platforms.length === 0) return "请选择合作平台（可多选）";
    if (styles.length === 0) return "请选择款式（可多选）";
    if (coopCategories.length === 0) return "请选择合作类目（可多选）";
    // 时间段选填；确定档期确认时必填
    if (confirmSchedule && !/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate)) return "请使用日期选择器填写确定档期";
    return null;
  }

  function cleanShipItems() {
    return shipItems
      .map((s) => ({
        style: s.style.trim(),
        degree: s.degree.trim(),
        shelfLife: s.shelfLife.trim(),
        boxCount: s.boxCount.trim(),
        note: s.note.trim(),
      }))
      .filter((s) => s.style || s.degree || s.shelfLife || s.boxCount || s.note);
  }

  async function submit(submitForApproval: boolean) {
    setError("");
    const err = await validate();
    if (err) return setError(err);
    // 寄品明细：填了行则款式名必填
    for (const s of cleanShipItems()) {
      if (!s.style) return setError("寄品明细中款式名为必填");
    }
    if (submitForApproval && selected.length === 0) return setError("提交审批必须选择至少一位审批人");
    // 提交审批需要二次确认（核对关键信息）
    if (submitForApproval) { setShowSubmitConfirm(true); return; }
    await doSubmit(false);
  }

  async function doSubmit(submitForApproval: boolean) {
    setSaving(true);
    const isProcurement = ticketKind === "PROCUREMENT" && !isEdit;

    // 编辑模式：PATCH 更新
    if (isEdit && editTicket) {
      const res = await fetch(`/api/tickets/${editTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          influencerId: type === "MAKEUP" ? null : partnerId || null,
          makeupArtistId: type === "MAKEUP" ? partnerId || null : null,
          budgetFee,
          platform: platforms,
          homepageId: homepageId.trim() || null,
          style: styles,
          coopCategory: coopCategories,
          contentDirection: contentDirection.trim() || null,
          priceNote: priceNote.trim() || null,
          contentNote: contentNote.trim() || null,
          estimatedSchedule: estimatedSchedule.trim(),
          confirmedDate: confirmSchedule && confirmedDate ? confirmedDate : null,
          startDate: startDate || null,
          endDate: endDate || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // 编辑后如需提交审批，调提交接口
      if (res.ok && submitForApproval) {
        if (selected.length === 0) { setSaving(false); return setError("提交审批必须选择至少一位审批人"); }
        const sres = await fetch(`/api/tickets/${editTicket.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approverIds: selected }),
        });
        const sdata = await sres.json().catch(() => ({}));
        setSaving(false);
        if (!sres.ok) return setError(sdata.error || "提交审批失败");
      } else {
        setSaving(false);
        if (!res.ok) return setError(data.error || "保存失败");
      }
      setOpen(false);
      router.refresh();
      return;
    }

    // 采买工单：只传品牌 / 平台 / 参考链接 / 采买请求列表；标题后端自动生成
    if (isProcurement) {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "__AUTO__",
          ticketKind,
          brandId,
          platform: platforms,
          link: procurementLink.trim() || null,
          items: procurementItems.map((it) => ({ style: it.style, quantity: Number(it.quantity) })),
          approverIds: selected,
          submit: submitForApproval,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) return setError(data.error || "提交失败");
      setOpen(false);
      router.refresh();
      return;
    }

    const finalContentDirection: string | null = contentDirection.trim() || null;
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // 合作/维护工单标题由后端自动生成（达人+平台+工单号）
        title: "__AUTO__",
        ticketKind,
        type,
        brandId,
        influencerId: type === "MAKEUP" ? null : partnerId,
        makeupArtistId: type === "MAKEUP" ? partnerId : null,
        budgetFee,
        platform: platforms,
        homepageId: homepageId.trim() || null,
        style: styles,
        coopCategory: coopCategories,
        contentDirection: finalContentDirection,
        priceNote: priceNote.trim() || null,
        contentNote: contentNote.trim() || null,
        estimatedSchedule: estimatedSchedule.trim(),
        confirmedDate: confirmSchedule && confirmedDate ? confirmedDate : null,
        startDate: startDate || null,
        endDate: endDate || null,
        note: note.trim() || null,
        approverIds: selected,
        submit: submitForApproval,
        attachments,
        shipItems: (() => { const c = cleanShipItems(); return c.length > 0 ? c : null; })(),
        coopRequestId: initialCoopRequestId ?? null,
        tagIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "提交失败");
    setOpen(false);
    router.refresh();
  }

  // 合作工单标题由后端自动生成（达人+平台+工单号），确认弹窗里显示预览
  const autoTitlePreview = (() => {
    const partnerName = partners.find((p) => p.id === partnerId)?.name ?? "";
    const platformLabel =
      platforms.length > 0
        ? (PLATFORM_TAG_OPTIONS.find((p) => p.value === platforms[0])?.label ?? platforms[0])
        : "";
    if (partnerName) return `${partnerName}+${platformLabel}+工单号`;
    if (platformLabel) return `${platformLabel}+工单号`;
    return "自动生成";
  })();

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        {isEdit ? "编辑工单" : isOperator ? "发起采买工单" : "发起工单"}
      </button>
      {open && (
        <Modal title={isEdit ? "编辑工单" : ticketKind === "PROCUREMENT" ? "发起采买工单" : ticketKind === "MAINTENANCE" ? "发起维护工单" : "发起合作工单"} onClose={() => setOpen(false)}>
          {!isOperator && !isEdit && (
            <Field label="工单类型" required hint="采买工单是合作工单的前置环节，运营提交采买需求">
              <div className="flex gap-2">
                {(Object.entries(ticketKindLabels) as [string, string][]).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTicketKind(v as "COOPERATION" | "PROCUREMENT" | "MAINTENANCE")}
                    className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                      ticketKind === v
                        ? "bg-primary text-white"
                        : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="所属品牌" required>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">请选择品牌</option>
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          {ticketKind === "PROCUREMENT" && !isEdit ? (
            <>
              {/* 采买请求：平台（上方品牌为共享字段）+ 参考链接 + 动态行列表 */}
              <Field label="合作平台（可多选）" required>
                <div className="flex flex-wrap gap-3">
                  {PLATFORM_TAG_OPTIONS.map((p) => (
                    <label key={p.value} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={platforms.includes(p.value)}
                        onChange={() =>
                          setPlatforms(platforms.includes(p.value) ? platforms.filter((x) => x !== p.value) : [...platforms, p.value])
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="参考链接" hint="选填，如达人发布链接">
                <input className={inputCls} value={procurementLink}
                  onChange={(e) => setProcurementLink(e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="采买请求" required hint="每行一款式 + 数量，至少 1 行">
                <div className="space-y-2">
                  {procurementItems.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        className={inputCls}
                        value={row.style}
                        onChange={(e) =>
                          setProcurementItems(procurementItems.map((r, j) => (j === i ? { ...r, style: e.target.value } : r)))
                        }
                      >
                        <option value="">请选择款式</option>
                        {STYLE_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <input
                        inputMode="numeric"
                        className={inputCls}
                        value={row.quantity}
                        onChange={(e) =>
                          setProcurementItems(procurementItems.map((r, j) => (j === i ? { ...r, quantity: e.target.value.replace(/[^\d]/g, "") } : r)))
                        }
                        placeholder="数量"
                      />
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={procurementItems.length <= 1}
                        onClick={() => setProcurementItems(procurementItems.filter((_, j) => j !== i))}
                        title={procurementItems.length <= 1 ? "至少保留 1 行" : "删除本行"}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => setProcurementItems([...procurementItems, { style: "", quantity: "" }])}
                  >
                    + 新增一行
                  </button>
                </div>
              </Field>
            </>

          ) : ticketKind === "MAINTENANCE" && !isEdit ? (
            <>
          {/* 维护工单：只显示品牌（上方共享）/合作对象/平台/款式/内容方向/备注；无档期/时间段、报价、采买字段 */}
          <Field label="合作类型" required>
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setPartnerId(""); }}>
              {Object.entries(coopTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "MAKEUP" ? "合作化妆师" : "合作达人"} required
            hint={type === "MAKEUP" ? "" : "仅可选择已通过审核的达人"}>
            <select className={inputCls} value={partnerId} onChange={(e) => onPartnerChange(e.target.value)}>
              <option value="">请选择</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="合作平台（可多选）" required>
            <div className="flex flex-wrap gap-3">
              {PLATFORM_TAG_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p.value)}
                    onChange={() =>
                      setPlatforms(platforms.includes(p.value) ? platforms.filter((x) => x !== p.value) : [...platforms, p.value])
                    }
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="款式（可多选）" required>
            <div className="flex flex-wrap gap-3">
              {STYLE_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={styles.includes(s.value)}
                    onChange={() =>
                      setStyles(styles.includes(s.value) ? styles.filter((x) => x !== s.value) : [...styles, s.value])
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="内容方向">
            <textarea className={inputCls} rows={2} value={contentDirection} onChange={(e) => setContentDirection(e.target.value)} />
          </Field>
          <Field label="备注">
            <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
            </>
          ) : (
            <>
          <Field label="合作类型" required>
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setPartnerId(""); }}>
              {Object.entries(coopTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "MAKEUP" ? "合作化妆师" : "合作达人"} required
            hint={type === "MAKEUP" ? "" : "仅可选择已通过审核的达人"}>
            <select className={inputCls} value={partnerId} onChange={(e) => onPartnerChange(e.target.value)}>
              <option value="">请选择</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          {occupancy && occupancy.occupied && (
            <OccupancyWarning occupancy={occupancy} />
          )}
          {ticketKind === "COOPERATION" && type !== "MAKEUP" && partnerId && (
            <InfluencerHistory influencerId={partnerId} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="合作平台（可多选）" required>
              <div className="flex flex-wrap gap-3">
                {PLATFORM_TAG_OPTIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={platforms.includes(p.value)}
                      onChange={() =>
                        setPlatforms(platforms.includes(p.value) ? platforms.filter((x) => x !== p.value) : [...platforms, p.value])
                      }
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="达人主页ID" hint="选达人自动带入，可手动修改">
              <input className={inputCls} value={homepageId} onChange={(e) => setHomepageId(e.target.value)}
                placeholder="如小红书号/抖音号" />
            </Field>
          </div>
          <Field label="款式（可多选）" required>
            <div className="flex flex-wrap gap-3">
              {STYLE_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={styles.includes(s.value)}
                    onChange={() =>
                      setStyles(styles.includes(s.value) ? styles.filter((x) => x !== s.value) : [...styles, s.value])
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="合作类目（可多选）" required>
            <div className="flex flex-wrap gap-3">
              {COOP_CATEGORY_OPTIONS.map((c) => (
                <label key={c.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={coopCategories.includes(c.value)}
                    onChange={() =>
                      setCoopCategories(coopCategories.includes(c.value) ? coopCategories.filter((x) => x !== c.value) : [...coopCategories, c.value])
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="时间段" hint="可选，如 2026-11-01 ~ 2026-11-15">
            <input className={inputCls} value={estimatedSchedule}
              onChange={(e) => setEstimatedSchedule(e.target.value)}
              placeholder="如：2026-11-01 ~ 2026-11-15" />
          </Field>
          <Field label="确定档期" hint="暂不确认不能进入合作中；确定档期齐全才能进合作中">
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setConfirmSchedule(true)}
                className={`px-3 py-1.5 rounded-md text-sm border ${confirmSchedule ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                确认档期
              </button>
              <button type="button" onClick={() => { setConfirmSchedule(false); setConfirmedDate(""); }}
                className={`px-3 py-1.5 rounded-md text-sm border ${!confirmSchedule ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                暂不确认
              </button>
            </div>
            {confirmSchedule && (
              <input type="date" className={inputCls} value={confirmedDate}
                onChange={(e) => setConfirmedDate(e.target.value)} />
            )}
          </Field>
          <Field label="内容方向">
            <textarea className={inputCls} rows={2} value={contentDirection} onChange={(e) => setContentDirection(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="价格备注">
              <textarea className={inputCls} rows={2} value={priceNote} onChange={(e) => setPriceNote(e.target.value)} />
            </Field>
            <Field label="内容备注">
              <textarea className={inputCls} rows={2} value={contentNote} onChange={(e) => setContentNote(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="预算费用（元）" required>
              <input type="number" min={0.01} step="0.01" className={inputCls}
                value={budgetFee} onChange={(e) => setBudgetFee(e.target.value)} />
            </Field>
            <Field label="时间段（起止日期，可选）">
              <div className="flex items-center gap-2">
                <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span className="shrink-0 text-sm text-muted-foreground">~</span>
                <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </Field>
          </div>
          <Field label="备注">
            <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
            </>
          )}
          {tagOptions.length > 0 && !(ticketKind === "PROCUREMENT" && !isEdit) && (
            <Field label="标签" hint="从标签管理中选择，可多选">
              <div className="flex flex-wrap gap-1.5">
                {tagOptions.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTagIds((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? "bg-primary text-white"
                          : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          {ticketKind !== "MAINTENANCE" && !(ticketKind === "PROCUREMENT" && !isEdit) && (
          <Field label="寄品明细" hint="需要寄样时填写，可寄多个款式；与合作款式独立">
            <ShipItemEditor value={shipItems} onChange={setShipItems} />
          </Field>
          )}
          {ticketKind !== "MAINTENANCE" && !(ticketKind === "PROCUREMENT" && !isEdit) && (
          <Field label="插图 / 附件" hint="可上传产品图、参考图等，图片会显示缩略图">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => uploadFile(f));
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploading && <p className="mt-1 text-xs text-muted-foreground">上传中…</p>}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded border border-border">
                    {isImage(a.fileName) ? (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}>
                        <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}
                        className="flex h-full w-full items-center justify-center bg-muted px-1 text-center text-[10px] text-primary">
                        {a.fileName}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                      className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-xs text-white"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
          )}
          <Field label="审批人（可多选，或签）" hint="提交审批时必填">
            <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-border p-2">
              {approvers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() =>
                      setSelected(selected.includes(a.id) ? selected.filter((x) => x !== a.id) : [...selected, a.id])
                    }
                  />
                  {a.name} <span className="text-xs text-muted-foreground">({roleLabels[a.role as never] ?? a.role})</span>
                </label>
              ))}
              {approvers.length === 0 && <p className="text-xs text-muted-foreground">暂无可选审批人</p>}
            </div>
          </Field>
          <p className="mb-3 rounded bg-primary/10 p-2 text-xs text-blue-800">
            {isEdit
              ? "保存后仍为草稿；补充完整合作信息（合作对象/类目/档期）后可提交审批。"
              : ticketKind === "PROCUREMENT"
              ? "提交后进入待采买审批，管理员逐条审批后分配给 PR 生成合作工单。"
              : ticketKind === "MAINTENANCE"
              ? "存为草稿后可在详情页转为合作工单；提交审批通过后也可转化，转化后回到草稿、补充合作信息后走完整合作流程。"
              : "提交审批后将按合作类型自动生成进度节点（寄品→执行→发布→数据回收）。"}
          </p>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button type="button" className={btnSecondary} disabled={saving} onClick={() => submit(false)}>
              {saving ? "保存中…" : isEdit ? "保存" : "存为草稿"}
            </button>
            <button type="button" className={btnPrimary} disabled={saving} onClick={() => submit(true)}>
              {saving ? "提交中…" : "提交审批"}
            </button>
          </div>
        </Modal>
      )}
      {showSubmitConfirm && (
        <ConfirmDialog
          title="确认提交审批"
          message={ticketKind === "PROCUREMENT"
            ? `采买请求：\n${procurementItems.map((it, i) => `${i + 1}. ${STYLE_OPTIONS.find((o) => o.value === it.style)?.label ?? it.style} × ${it.quantity}`).join("\n")}${procurementLink.trim() ? `\n参考链接：${procurementLink.trim()}` : ""}\n审批人：${approvers.filter((a) => selected.includes(a.id)).map((a) => a.name).join("、")}\n\n提交后将通知审批人，确认提交吗？`
            : ticketKind === "MAINTENANCE"
            ? `标题：${autoTitlePreview}（自动生成）\n合作对象：${partners.find((p) => p.id === partnerId)?.name ?? ""}\n审批人：${approvers.filter((a) => selected.includes(a.id)).map((a) => a.name).join("、")}\n\n提交后将通知审批人，确认提交吗？`
            : `标题：${autoTitlePreview}（自动生成）\n合作对象：${partners.find((p) => p.id === partnerId)?.name ?? ""}\n预算费用：¥${budgetFee}\n审批人：${approvers.filter((a) => selected.includes(a.id)).map((a) => a.name).join("、")}\n\n提交后将通知审批人，确认提交吗？`}
          confirmText="确认提交"
          busy={saving}
          onClose={() => setShowSubmitConfirm(false)}
          onConfirm={async () => { setShowSubmitConfirm(false); await doSubmit(true); }}
        />
      )}
    </>
  );
}
