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

        _loadEmailLogs: function (aFilters) {
            const oODataModel = this.getODataModel();
            const oVM = this.getViewModel();

            this._oBusy.open();

            oODataModel.read("/EmailLog", {
                filters: aFilters || [],
                success: function (oData) {
                    const aResults = (oData && oData.results) || [];
                    const aMapped = aResults.map(this._mapHeaderLog.bind(this));

                    oVM.setProperty("/logs", aMapped);
                    this._oBusy.close();
                }.bind(this),
                error: function (oError) {
                    this._oBusy.close();
                    MessageBox.error("Không tải được Email Logs từ OData service.");
                    // optional: console.error(oError);
                }.bind(this)
            });
        },

        _mapHeaderLog: function (oItem) {
            const sStatusCode = oItem.Status || "";
            const oStatusInfo = this._mapStatus(sStatusCode);

            return {
                RunId: oItem.RunId,
                TemplateId: oItem.TemplateId || "",
                ObjKey: oItem.ObjKey || "",
                ObjType: oItem.ObjType || "",
                SentBy: oItem.SentBy || "",
                SentDate: oItem.SentDate || null,
                SentTime: oItem.SentTime || "",
                SentAtText: this._formatSentAt(oItem.SentDate, oItem.SentTime),
                Status: sStatusCode,
                StatusText: oStatusInfo.text,
                StatusState: oStatusInfo.state,
                MimeType: oItem.MimeType || "",
                FileName: oItem.FileName || ""
            };
        },

        _mapStatus: function (sStatus) {
            switch (sStatus) {
                case "S":
                    return { text: "Sent", state: "Success" };
                case "F":
                    return { text: "Failed", state: "Error" };
                case "P":
                    return { text: "Pending", state: "Warning" };
                case "O":
                    return { text: "Processed", state: "Information" };
                default:
                    return { text: sStatus || "Unknown", state: "None" };
            }
        },

        _formatSentAt: function (sDate, sDuration) {
            if (!sDate) {
                return "-";
            }

            const oDate = new Date(sDate);
            if (isNaN(oDate.getTime())) {
                return sDate;
            }

            const sTime = this._durationToTime(sDuration);
            const sDateText = oDate.toLocaleDateString("en-GB");

            return sTime ? (sDateText + " " + sTime) : sDateText;
        },

        _durationToTime: function (sDuration) {
            if (!sDuration) {
                return "";
            }

            const aMatch = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(sDuration);
            if (!aMatch) {
                return sDuration;
            }

            const sHours = String(parseInt(aMatch[1] || "0", 10)).padStart(2, "0");
            const sMinutes = String(parseInt(aMatch[2] || "0", 10)).padStart(2, "0");
            const sSeconds = String(parseInt(aMatch[3] || "0", 10)).padStart(2, "0");

            return sHours + ":" + sMinutes + ":" + sSeconds;
        },

        onSearch: function () {
            const aFilters = this._buildFilters();
            this._loadEmailLogs(aFilters);
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
            const dTo = oDateRange.getSecondDateValue() || dFrom;

            if (sRecipient) {
                aFilters.push(new Filter("Recipient", FilterOperator.Contains, sRecipient));
            }

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

            if (dFrom) {
                const dStart = new Date(dFrom);
                dStart.setHours(0, 0, 0, 0);
                aFilters.push(new Filter("SentDate", FilterOperator.GE, dStart));
            }

            if (dTo) {
                const dEnd = new Date(dTo);
                dEnd.setHours(23, 59, 59, 999);
                aFilters.push(new Filter("SentDate", FilterOperator.LE, dEnd));
            }

            return aFilters;
        },

        onClearFilter: function () {
            const oView = this.getView();

            oView.byId("sfRecipient").setValue("");
            oView.byId("mcbStatus").setSelectedKeys([]);
            oView.byId("drsSentDate").setDateValue(null);
            oView.byId("drsSentDate").setSecondDateValue(null);
            oView.byId("drsSentDate").setValue("");

            this._loadEmailLogs([]);
        },

        onRefresh: function () {
            this._loadEmailLogs(this._buildFilters());
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
            const sFirstRecipient = aDetails[0]?.Recipient || "-";
            const sFirstMessage = aDetails[0]?.MsgVar1 || "";
            const sContent = aDetails[0]?.Content || "No detail content available.";

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

            const aContent = [
                new VBox({
                    width: "100%",
                    items: [
                        new Title({ text: "General Information", level: "H4" }),

                        this._buildInfoRow("Run ID:", oLog.RunId),
                        this._buildInfoRow("Template ID:", oLog.TemplateId || "-"),
                        this._buildInfoRow("Status:", oLog.StatusText || "-"),
                        this._buildInfoRow("Sent At:", oLog.SentAtText || "-"),
                        this._buildInfoRow("Recipient:", sFirstRecipient),
                        this._buildInfoRow("File:", oLog.FileName || "-"),

                        new Title({ text: "Message", level: "H4" }).addStyleClass("sapUiMediumMarginTop"),
                        new MessageStrip({
                            text: sFirstMessage || "No message available.",
                            type: oLog.StatusState === "Error" ? "Error" : "Information",
                            showIcon: true
                        }).addStyleClass("sapUiSmallMarginBottom"),

                        new Title({ text: "Content", level: "H4" }),
                        new HTML({
                            content:
                                "<div style='padding:0.75rem;border:1px solid var(--sapList_BorderColor);border-radius:0.75rem;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--sapGroup_ContentBackground);'>" +
                                this._escapeHtml(sContent) +
                                "</div>"
                        })
                    ]
                })
            ];

            this._oDetailDialog.removeAllContent();
            aContent.forEach(function (oItem) {
                this._oDetailDialog.addContent(oItem);
            }.bind(this));

            this._oDetailDialog.open();
        },

        _buildInfoRow: function (sLabel, sValue) {
            return new HBox({
                items: [
                    new Label({ text: sLabel, width: "120px" }),
                    new Text({ text: sValue || "-" })
                ]
            }).addStyleClass("sapUiSmallMarginBottom");
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