"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { roleLabels, coopTypeLabels, PLATFORM_TAG_OPTIONS, STYLE_OPTIONS, COOP_CATEGORY_OPTIONS, ticketKindLabels, procurementSubTypeLabels } from "@/lib/labels";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { OccupancyWarning } from "./OccupancyWarning";
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
  const [ticketKind, setTicketKind] = useState<"COOPERATION" | "PROCUREMENT">(
    isOperator ? "PROCUREMENT" : "COOPERATION"
  );
  // 采买子类型
  const [procurementType, setProcurementType] = useState<"WEEKLY_STYLE" | "LINK_SPECIFIC">("WEEKLY_STYLE");
  // 采买特有输入：提交时合并写入 note / contentDirection（合作工单子集字段）
  const [quantity, setQuantity] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [reason, setReason] = useState("");
  const [publishLinksText, setPublishLinksText] = useState("");
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
  // v2: 预估发布年月 / 预估报价 / 确定档期（确认或暂不确认）
  const [estimatedPublishMonth, setEstimatedPublishMonth] = useState(editTicket?.estimatedPublishMonth ?? "");
  const [quoteAmount, setQuoteAmount] = useState(editTicket?.quoteAmount ?? "");
  const [confirmSchedule, setConfirmSchedule] = useState(!!editTicket?.confirmedDate);
  const [confirmedDate, setConfirmedDate] = useState(editTicket?.confirmedDate ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  // 寄品明细：可寄多个款式，每行 {款式名、度数、寄品备注}
  const [shipItems, setShipItems] = useState<{ style: string; degree: string; note: string }[]>([]);
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
    if (!title.trim()) return "标题不能为空";
    if (!brandId) return "请选择所属品牌";
    if (!budgetFee || Number(budgetFee) <= 0) return "预算费用必须大于 0";
    // 采买工单：字段为合作工单子集，按子类型校验
    if (ticketKind === "PROCUREMENT" && !isEdit) {
      if (platforms.length === 0) return "请选择合作平台（可多选）";
      if (procurementType === "WEEKLY_STYLE") {
        if (styles.length === 0) return "请选择款式（可多选）";
        if (!/^[1-9]\d*$/.test(quantity.trim())) return "采买数量必须为正整数";
      } else {
        if (!materialType.trim()) return "请填写素材类型";
        if (!reason.trim()) return "请填写需求理由";
        const links = publishLinksText.split("\n").map((s) => s.trim()).filter(Boolean);
        if (links.length === 0) return "请至少填写一条发布链接";
      }
      return null;
    }
    // 合作工单：原有校验
    if (!partnerId) return "请选择合作对象";
    if (platforms.length === 0) return "请选择合作平台（可多选）";
    if (styles.length === 0) return "请选择款式（可多选）";
    if (coopCategories.length === 0) return "请选择合作类目（可多选）";
    if (!estimatedSchedule.trim()) return "请填写预估档期";
    // v2: 预估发布年月 / 预估报价必填；确定档期确认时必填
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(estimatedPublishMonth.trim())) return "请填写预估发布年月（如 2026-11）";
    if (!quoteAmount || Number(quoteAmount) <= 0) return "预估报价必须大于 0";
    if (confirmSchedule && !/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate)) return "请使用日期选择器填写确定档期";
    return null;
  }

  function cleanShipItems() {
    return shipItems
      .map((s) => ({ style: s.style.trim(), degree: s.degree.trim(), note: s.note.trim() }))
      .filter((s) => s.style || s.degree || s.note);
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
          estimatedPublishMonth: estimatedPublishMonth.trim() || null,
          quoteAmount: quoteAmount || null,
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

    // 采买工单：特有信息合并写入 note / contentDirection（合作工单子集字段）
    let finalNote: string | null = note.trim() || null;
    let finalContentDirection: string | null = contentDirection.trim() || null;
    if (isProcurement) {
      const lines = ["【采买信息】"];
      if (procurementType === "WEEKLY_STYLE") {
        lines.push(`采买数量：${Number(quantity)}`);
      } else {
        finalContentDirection = materialType.trim();
        lines.push(`需求理由：${reason.trim()}`);
        const links = publishLinksText.split("\n").map((s) => s.trim()).filter(Boolean);
        lines.push(`发布链接：\n${links.map((l, i) => `${i + 1}. ${l}`).join("\n")}`);
      }
      if (note.trim()) lines.push(`备注：${note.trim()}`);
      finalNote = lines.join("\n");
    }

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        ticketKind,
        type,
        brandId,
        ...(isProcurement ? { procurementType } : {}),
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
        estimatedPublishMonth: estimatedPublishMonth.trim() || null,
        quoteAmount: quoteAmount || null,
        confirmedDate: confirmSchedule && confirmedDate ? confirmedDate : null,
        startDate: startDate || null,
        endDate: endDate || null,
        note: finalNote,
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

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        {isEdit ? "编辑工单" : isOperator ? "发起采买工单" : "发起工单"}
      </button>
      {open && (
        <Modal title={isEdit ? "编辑工单" : ticketKind === "PROCUREMENT" ? "发起采买工单" : "发起合作工单"} onClose={() => setOpen(false)}>
          {!isOperator && !isEdit && (
            <Field label="工单类型" required hint="采买工单是合作工单的前置环节，运营提交采买需求">
              <div className="flex gap-2">
                {(Object.entries(ticketKindLabels) as [string, string][]).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTicketKind(v as "COOPERATION" | "PROCUREMENT")}
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
              <Field label="采买子类型" required>
                <div className="flex gap-2">
                  {(Object.entries(procurementSubTypeLabels) as [string, string][]).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setProcurementType(v as "WEEKLY_STYLE" | "LINK_SPECIFIC")}
                      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                        procurementType === v
                          ? "bg-primary text-white"
                          : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="标题" required hint="如：双11款式采买">
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              {/* 合作平台：与合作工单同字段，接单转入后直接沿用 */}
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
              {procurementType === "WEEKLY_STYLE" ? (
                <>
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
                  <Field label="采买数量" required hint="无指定达人，按数量采买；将记入备注">
                    <select className={inputCls}
                      value={quantity} onChange={(e) => setQuantity(e.target.value)}>
                      <option value="">请选择数量</option>
                      {[5, 10, 15, 20, 25, 30, 40, 50, 80, 100, 150, 200].map((n) => (
                        <option key={n} value={String(n)}>{n}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="素材类型" required hint="将记入内容方向">
                    <input className={inputCls} value={materialType}
                      onChange={(e) => setMaterialType(e.target.value)} placeholder="如：短视频 / 图文笔记" />
                  </Field>
                  <Field label="需求理由" required hint="已是本品牌款式，但可能未授权/未上传；将记入备注">
                    <textarea className={inputCls} rows={2} value={reason}
                      onChange={(e) => setReason(e.target.value)} placeholder="请说明采买理由" />
                  </Field>
                  <Field label="发布链接" required hint="每行一条，可填多条；将记入备注">
                    <textarea className={inputCls} rows={3} value={publishLinksText}
                      onChange={(e) => setPublishLinksText(e.target.value)}
                      placeholder="https://...&#10;https://..." />
                  </Field>
                </>
              )}
              <Field label="预算费用（元）" required>
                <input type="number" min={0.01} step="0.01" className={inputCls}
                  value={budgetFee} onChange={(e) => setBudgetFee(e.target.value)} />
              </Field>
              <Field label="备注">
                <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
          <Field label="标题" required hint="如：双11美妆老王达播合作">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
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
          <Field label="预估档期" required hint='如"10月下旬"或"2026-10-20~2026-10-31"，仅作参考，不锁定工单'>
            <input className={inputCls} value={estimatedSchedule}
              onChange={(e) => setEstimatedSchedule(e.target.value)}
              placeholder='如：10月下旬 / 2026-10-20~2026-10-31' />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="预估发布年月" required>
              <input type="month" className={inputCls} value={estimatedPublishMonth}
                onChange={(e) => setEstimatedPublishMonth(e.target.value)} />
            </Field>
            <Field label="预估报价（元）" required>
              <input type="number" min={0.01} step="0.01" className={inputCls} autoComplete="off"
                value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
            </Field>
          </div>
          <Field label="确定档期" hint="暂不确认不能进入合作中；报价+确定档期齐全才能进合作中">
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
          <div className="grid grid-cols-3 gap-3">
            <Field label="预算费用（元）" required>
              <input type="number" min={0.01} step="0.01" className={inputCls}
                value={budgetFee} onChange={(e) => setBudgetFee(e.target.value)} />
            </Field>
            <Field label="档期开始">
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="档期结束">
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <Field label="备注">
            <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
            </>
          )}
          {tagOptions.length > 0 && (
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
          <Field label="寄品明细" hint="需要寄样时填写，可寄多个款式；与合作款式独立">
            <div className="space-y-2">
              {shipItems.map((s, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg bg-muted p-2">
                  <div className="min-w-[120px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">款式名 *</label>
                    <input className={inputCls} value={s.style}
                      onChange={(e) => setShipItems(shipItems.map((x, j) => j === i ? { ...x, style: e.target.value } : x))}
                      placeholder="如：A款-红色" />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-xs text-muted-foreground">度数</label>
                    <input className={inputCls} value={s.degree}
                      onChange={(e) => setShipItems(shipItems.map((x, j) => j === i ? { ...x, degree: e.target.value } : x))}
                      placeholder="选填" />
                  </div>
                  <div className="min-w-[140px] flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">寄品备注</label>
                    <input className={inputCls} value={s.note}
                      onChange={(e) => setShipItems(shipItems.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                      placeholder="选填" />
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-300 px-2.5 py-2 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => setShipItems(shipItems.filter((_, j) => j !== i))}
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => setShipItems([...shipItems, { style: "", degree: "", note: "" }])}
              >
                + 增加一款
              </button>
            </div>
          </Field>
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
              ? "提交后进入待采买审批，审批通过后PR接单即转入合作工单流程（同单流转）。"
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
            ? `标题：${title.trim()}\n类型：${procurementSubTypeLabels[procurementType]}\n预算费用：¥${budgetFee}\n审批人：${approvers.filter((a) => selected.includes(a.id)).map((a) => a.name).join("、")}\n\n提交后将通知审批人，确认提交吗？`
            : `标题：${title.trim()}\n合作对象：${partners.find((p) => p.id === partnerId)?.name ?? ""}\n预算费用：¥${budgetFee}\n审批人：${approvers.filter((a) => selected.includes(a.id)).map((a) => a.name).join("、")}\n\n提交后将通知审批人，确认提交吗？`}
          confirmText="确认提交"
          busy={saving}
          onClose={() => setShowSubmitConfirm(false)}
          onConfirm={async () => { setShowSubmitConfirm(false); await doSubmit(true); }}
        />
      )}
    </>
  );
}
