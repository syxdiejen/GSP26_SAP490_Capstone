sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Label",
    "sap/m/MessageStrip",
    "sap/ui/core/HTML",
    "sap/m/BusyDialog",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    Dialog,
    Button,
    VBox,
    HBox,
    Text,
    Title,
    Label,
    MessageStrip,
    HTML,
    BusyDialog,
    MessageToast,
    MessageBox
) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.logs.EmailLogs", {
        onInit: function () {
            this._oBusy = new BusyDialog();

            const oVM = new JSONModel({
                logs: [],
                selectedLog: null,
                details: []
            });

            this.getView().setModel(oVM, "vm");
            this._loadEmailLogs();
        },

        getODataModel: function () {
            return this.getOwnerComponent().getModel();
        },

        getViewModel: function () {
            return this.getView().getModel("vm");
        },

        _loadEmailLogs: function (aFilters, sRecipientQuery) {
            const oODataModel = this.getODataModel();
            const oVM = this.getViewModel();

            this._oBusy.open();

            oODataModel.read("/EmailLog", {
                filters: aFilters || [],
                urlParameters: {
                    "$expand": "to_Attachments,to_Details"
                },
                success: function (oData) {
                    const aResults = (oData && oData.results) || [];
                    const aMapped = aResults.map(this._mapHeaderLog.bind(this));

                    let aFinal = aMapped;

                    if (sRecipientQuery) {
                        const sNeedle = sRecipientQuery.toLowerCase();

                        aFinal = aMapped.filter(function (oItem) {
                            return [
                                oItem.Recipient,
                                oItem.RecipientTo,
                                oItem.RecipientCc,
                                oItem.RecipientBcc
                            ].some(function (v) {
                                return (v || "").toLowerCase().includes(sNeedle);
                            });
                        });
                    }

                    oVM.setProperty("/logs", aFinal);
                    this._oBusy.close();
                }.bind(this),
                error: function () {
                    this._oBusy.close();
                    MessageBox.error("Không tải được Email Logs từ OData service.");
                }.bind(this)
            });
        },

        _mapHeaderLog: function (oItem) {
            const sStatusCode = oItem.Status || "";
            const oStatusInfo = this._mapStatus(sStatusCode);

            const aAttachments = (oItem.to_Attachments && oItem.to_Attachments.results) || [];
            const oFirstAttachment = aAttachments[0] || null;

            const aDetails = (oItem.to_Details && oItem.to_Details.results) || [];

            const oRecipients = this._groupRecipients(aDetails);

            return {
                RunId: oItem.RunId,
                TemplateId: oItem.TemplateId || "",
                SentBy: oItem.SentBy || "",
                SentDate: oItem.SentDate || null,
                SentTime: oItem.SentTime || "",
                SentAtText: this._formatSentAt(oItem.SentDate, oItem.SentTime),
                Status: sStatusCode,
                StatusText: oStatusInfo.text,
                StatusState: oStatusInfo.state,

                RawContent: oItem.RawContent || "",
                ComposeContent: oItem.ComposeContent || "",

                Details: aDetails,
                Recipient: oRecipients.to || oRecipients.summary,
                RecipientTo: oRecipients.to,
                RecipientCc: oRecipients.cc,
                RecipientBcc: oRecipients.bcc,

                Attachments: aAttachments,
                FileId: oFirstAttachment ? oFirstAttachment.FileId : null,
                MimeType: oFirstAttachment ? (oFirstAttachment.MimeType || "") : "",
                FileName: oFirstAttachment ? (oFirstAttachment.FileName || "") : ""
            };
        },

        _mapStatus: function (sStatus) {
            switch (sStatus) {
                case "O":
                    return { text: "Sent", state: "Success" };
                case "E":
                    return { text: "Failed", state: "Error" };
                case "P":
                    return { text: "Pending", state: "Warning" };
                // case "O":
                //     return { text: "Processed", state: "Information" };
                default:
                    return { text: sStatus || "Unknown", state: "None" };
            }
        },

        _groupRecipients: function (aDetails) {
            const aTo = [];
            const aCc = [];
            const aBcc = [];
            const aOther = [];

            (aDetails || []).forEach(function (oItem) {
                const sEmail = (oItem.Recipient || "").trim();
                const sType = (oItem.RecType || "").toUpperCase().trim();

                if (!sEmail) {
                    return;
                }

                switch (sType) {
                    case "TO":
                        if (!aTo.includes(sEmail)) {
                            aTo.push(sEmail);
                        }
                        break;
                    case "CC":
                        if (!aCc.includes(sEmail)) {
                            aCc.push(sEmail);
                        }
                        break;
                    case "BCC":
                        if (!aBcc.includes(sEmail)) {
                            aBcc.push(sEmail);
                        }
                        break;
                    default:
                        if (!aOther.includes(sEmail)) {
                            aOther.push(sEmail);
                        }
                        break;
                }
            });

            const aSummaryParts = [];

            if (aTo.length) {
                aSummaryParts.push("TO: " + aTo.join(", "));
            }
            if (aCc.length) {
                aSummaryParts.push("CC: " + aCc.join(", "));
            }
            if (aBcc.length) {
                aSummaryParts.push("BCC: " + aBcc.join(", "));
            }
            if (aOther.length) {
                aSummaryParts.push(aOther.join(", "));
            }

            return {
                to: aTo.join(", "),
                cc: aCc.join(", "),
                bcc: aBcc.join(", "),
                summary: aSummaryParts.join(" | ")
            };
        },

        _formatSentAt: function (vDate, vTime) {
            if (!vDate) {
                return "-";
            }

            let oDate = null;

            // OData V2 Date string: /Date(1711929600000)/
            if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                oDate = new Date(parseInt(vDate.replace(/[^0-9]/g, ""), 10));
            }
            // JS Date object
            else if (vDate instanceof Date) {
                oDate = vDate;
            }
            // OData date object or other object forms
            else if (typeof vDate === "object") {
                if (vDate.ms !== undefined) {
                    oDate = new Date(vDate.ms);
                } else if (vDate.__edmType === "Edm.DateTime" && vDate.value) {
                    oDate = new Date(vDate.value);
                } else {
                    oDate = new Date(vDate);
                }
            }
            // fallback
            else {
                oDate = new Date(vDate);
            }

            if (!oDate || isNaN(oDate.getTime())) {
                return "-";
            }

            const sTime = this._durationToTime(vTime);

            const sDay = String(oDate.getDate()).padStart(2, "0");
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sYear = oDate.getFullYear();

            return sTime
                ? (sTime + ", " + sDay + "/" + sMonth + "/" + sYear)
                : (sDay + "/" + sMonth + "/" + sYear);
        },

        onOpenAttachment: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("vm");

            if (!oContext) {
                return;
            }

            const oLog = oContext.getObject();

            if (!oLog.RunId || oLog.FileId === null || oLog.FileId === undefined) {
                MessageToast.show("Không có file đính kèm.");
                return;
            }

            const sServiceUrl = this.getODataModel().sServiceUrl;
            const sUrl =
                sServiceUrl +
                "/AttachmentLogs(RunId=guid'" +
                oLog.RunId +
                "',FileId=" +
                oLog.FileId +
                ")/$value";

            window.open(sUrl, "_blank");
        },

        _durationToTime: function (vDuration) {
            if (!vDuration) {
                return "";
            }

            // OData V2 Edm.Time thường có dạng { ms: 49541000, __edmType: "Edm.Time" }
            if (typeof vDuration === "object") {
                if (vDuration.ms !== undefined) {
                    const iTotalSeconds = Math.floor(vDuration.ms / 1000);
                    const iHours = Math.floor(iTotalSeconds / 3600);
                    const iMinutes = Math.floor((iTotalSeconds % 3600) / 60);
                    const iSeconds = iTotalSeconds % 60;

                    return [
                        String(iHours).padStart(2, "0"),
                        String(iMinutes).padStart(2, "0"),
                        String(iSeconds).padStart(2, "0")
                    ].join(":");
                }

                return "";
            }

            if (typeof vDuration === "string") {
                const aMatch = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(vDuration);

                if (aMatch) {
                    const sHours = String(parseInt(aMatch[1] || "0", 10)).padStart(2, "0");
                    const sMinutes = String(parseInt(aMatch[2] || "0", 10)).padStart(2, "0");
                    const sSeconds = String(parseInt(aMatch[3] || "0", 10)).padStart(2, "0");

                    return sHours + ":" + sMinutes + ":" + sSeconds;
                }

                return vDuration;
            }

            return "";
        },

        onSearch: function () {
            const oFilterData = this._buildFilters();
            this._loadEmailLogs(oFilterData.filters, oFilterData.recipientQuery);
        },
        
        _buildFilters: function () {
            const oView = this.getView();
            const aFilters = [];

            const oSearchField = oView.byId("sfRecipient");
            const oStatusBox = oView.byId("mcbStatus");
            const oDateRange = oView.byId("drsSentDate");

            const sRecipient = (oSearchField.getValue() || "").trim();
            const aStatuses = oStatusBox.getSelectedKeys();
            const dFrom = oDateRange.getDateValue();
            const dTo = oDateRange.getSecondDateValue();

            // Không filter Recipient ở OData vì Recipient không thuộc EmailLogType
            // Recipient chỉ có trong to_Details / client mapping

            if (aStatuses.length === 1) {
                aFilters.push(new Filter("Status", FilterOperator.EQ, aStatuses[0]));
            } else if (aStatuses.length > 1) {
                const aStatusFilters = aStatuses.map(function (sKey) {
                    return new Filter("Status", FilterOperator.EQ, sKey);
                });
                aFilters.push(new Filter({
                    filters: aStatusFilters,
                    and: false
                }));
            }

            if (dFrom && dTo) {
                const dStart = new Date(dFrom);
                dStart.setHours(0, 0, 0, 0);

                const dEnd = new Date(dTo);
                dEnd.setHours(0, 0, 0, 0);

                aFilters.push(new Filter("SentDate", FilterOperator.BT, dStart, dEnd));
            } else if (dFrom) {
                const dSingle = new Date(dFrom);
                dSingle.setHours(0, 0, 0, 0);

                aFilters.push(new Filter("SentDate", FilterOperator.EQ, dSingle));
            }

            return {
                filters: aFilters,
                recipientQuery: sRecipient
            };
        },

        onClearFilter: function () {
            const oView = this.getView();

            oView.byId("sfRecipient").setValue("");
            oView.byId("mcbStatus").setSelectedKeys([]);
            oView.byId("drsSentDate").setDateValue(null);
            oView.byId("drsSentDate").setSecondDateValue(null);
            oView.byId("drsSentDate").setValue("");

            this._loadEmailLogs([], "");;
        },

        onRefresh: function () {
            const oFilterData = this._buildFilters();
            this._loadEmailLogs(oFilterData.filters, oFilterData.recipientQuery);
            MessageToast.show("Email logs refreshed");
        },

        onViewDetail: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("vm");

            if (!oContext) {
                return;
            }

            const oLog = oContext.getObject();
            this._loadLogDetails(oLog);
        },

        _loadLogDetails: function (oLog) {
            const oODataModel = this.getODataModel();
            const sPath = "/EmailLog(guid'" + oLog.RunId + "')/to_Details";

            this._oBusy.open();

            oODataModel.read(sPath, {
                success: function (oData) {
                    const aDetails = (oData && oData.results) || [];
                    this._openDetailDialog(oLog, aDetails);
                    this._oBusy.close();
                }.bind(this),
                error: function () {
                    this._oBusy.close();
                    MessageBox.error("Không tải được chi tiết log.");
                }.bind(this)
            });
        },

        _openDetailDialog: function (oLog, aDetails) {
            const oRecipients = this._groupRecipients(aDetails);

            const sFirstMessage = aDetails[0]?.MsgVar1 || "";
            const sHtmlContent = oLog.ComposeContent || "";
            const sPlainContent = oLog.RawContent || aDetails[0]?.Content || "No detail content available.";
            const bHasHtmlContent = !!sHtmlContent;

            if (!this._oDetailDialog) {
                this._oDetailDialog = new Dialog({
                    title: "Email Log Detail",
                    contentWidth: "720px",
                    contentHeight: "520px",
                    resizable: true,
                    draggable: true,
                    verticalScrolling: true,
                    endButton: new Button({
                        text: "Close",
                        press: function () {
                            this._oDetailDialog.close();
                        }.bind(this)
                    })
                });

                this.getView().addDependent(this._oDetailDialog);
            }

            const aItems = [
                new Title({ text: "General Information", level: "H4" }),

                this._buildInfoRow("Template ID:", oLog.TemplateId || "-"),
                this._buildInfoRow("Status:", oLog.StatusText || "-"),
                this._buildInfoRow("Sent At:", oLog.SentAtText || "-"),
                this._buildInfoRow("TO:", oRecipients.to || "-"),
                this._buildInfoRow("CC:", oRecipients.cc || "-"),
                this._buildInfoRow("BCC:", oRecipients.bcc || "-"),
                this._buildInfoRow("File:", oLog.FileName || "-"),

                new Title({ text: "Content", level: "H4" }).addStyleClass("sapUiMediumMarginTop")
            ];

            if (bHasHtmlContent) {
                aItems.push(
                    new HTML({
                        content:
                            "<div style='padding:0.75rem;border:1px solid var(--sapList_BorderColor);border-radius:0.75rem;max-height:220px;overflow:auto;background:var(--sapGroup_ContentBackground);'>" +
                            sHtmlContent +
                            "</div>"
                    })
                );
            } else {
                aItems.push(
                    new HTML({
                        content:
                            "<div style='padding:0.75rem;border:1px solid var(--sapList_BorderColor);border-radius:0.75rem;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--sapGroup_ContentBackground);'>" +
                            this._escapeHtml(sPlainContent) +
                            "</div>"
                    })
                );
            }

            aItems.push(
                new Title({ text: "Message", level: "H4" }).addStyleClass("sapUiMediumMarginTop"),
                new MessageStrip({
                    text: sFirstMessage || "No message available.",
                    type: oLog.StatusState === "Error" ? "Error" : "Information",
                    showIcon: true
                }).addStyleClass("sapUiSmallMarginBottom")
            );

            this._oDetailDialog.removeAllContent();
            this._oDetailDialog.addContent(
                new VBox({
                    width: "100%",
                    items: [
                        new VBox({
                            width: "100%",
                            items: aItems
                        }).addStyleClass("sapUiResponsiveContentPadding")
                    ]
                })
            );

            this._oDetailDialog.open();
        },

        _buildInfoRow: function (sLabel, sValue) {
            return new HBox({
                alignItems: "Start",
                items: [
                    new Label({
                        text: sLabel,
                        width: "130px"
                    }).addStyleClass("sapUiTinyMarginEnd"),

                    new Text({
                        text: sValue || "-",
                        wrapping: true
                    }).addStyleClass("sapUiSmallMarginBottom")
                ]
            }).addStyleClass("sapUiTinyMarginBottom");
        },

        _escapeHtml: function (sText) {
            return String(sText || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }
    });
});