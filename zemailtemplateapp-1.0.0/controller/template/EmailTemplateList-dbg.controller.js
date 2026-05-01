sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/model/formatter",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/core/HTML",
    "zemail/template/app/util/ErrorHandler"
  ],
  function (
    Controller,
    MessageToast,
    MessageBox,
    JSONModel,
    formatter,
    Dialog,
    Button,
    HTML,
    ErrorHandler
  ) {
    "use strict";

    return Controller.extend(
      "zemail.template.app.controller.template.EmailTemplateList",
      {
        formatter: formatter,

        // =========================================================
        // 1. LIFECYCLE
        // =========================================================
        onInit: function () {
          this._initViewModel();

          this._oRouter = this.getOwnerComponent().getRouter();
          this._oRouter
            .getRoute("templatelist")
            .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
          this._loadTemplates();
        },

        // =========================================================
        // 2. MODEL HELPERS
        // =========================================================
        _initViewModel: function () {
          var oEmailModel = new JSONModel({
            EmailTemplates: [],
            AllEmailTemplates: [],
            SearchValue: "",
            SelectedCategory: "ALL",
            Busy: false,
          });

          this.getView().setModel(oEmailModel, "email");
        },

        _getEmailModel: function () {
          return this.getView().getModel("email");
        },

        _getODataModel: function () {
          return this.getOwnerComponent().getModel();
        },

        _setBusy: function (bBusy) {
          this._getEmailModel().setProperty("/Busy", !!bBusy);
        },

        _getBundle: function () {
          return this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
        },

        // =========================================================
        // 3. LOAD / MAP / FILTER DATA
        // =========================================================
        _loadTemplates: function () {
          var oODataModel = this._getODataModel();
          var oEmailModel = this._getEmailModel();

          this._setBusy(true);

          oODataModel.read("/EmailHeader", {
            urlParameters: {
              $expand: "to_Body",
              $format: "json",
              $orderby: "CreatedAt desc",
            },
            success: function (oData) {
              var aResults = Array.isArray(oData && oData.results)
                ? oData.results
                : [];
              var aMappedTemplates = aResults.map(this._mapTemplate.bind(this));

              oEmailModel.setProperty("/AllEmailTemplates", aMappedTemplates);
              this._applyFilters();
              this._setBusy(false);
            }.bind(this),
            error: function (oError) {
              this._setBusy(false);
                console.log("RAW ERROR:", oError);

                console.log(
                  "PARSED MESSAGE:",
                  ErrorHandler.extractMessage(oError, this._getBundle())
                );

                ErrorHandler.show(oError, this._getBundle(), "loadTemplateFailed");

            }.bind(this),
          });
        },

        _mapTemplate: function (oItem) {
          var aBodies =
            oItem.to_Body && Array.isArray(oItem.to_Body.results)
              ? oItem.to_Body.results
              : [];
        
          var sFullContent = aBodies
            .map(function (oBody) {
              return oBody.Content || "";
            })
            .join("\n")
            .trim();

          var sSubject = oItem.Subject || "";
          if (!sSubject) {
            sSubject = this._extractSubject(sFullContent);
            sFullContent = this._removeSubjectLine(sFullContent);
          }

          var oFirstBody = aBodies.length > 0 ? aBodies[0] : null;

          return {
            DbKey: oItem.DbKey,
            IsActiveEntity: oItem.IsActiveEntity,
            HasActiveEntity: oItem.HasActiveEntity,
            HasDraftEntity: oItem.HasDraftEntity,
            TemplateId: oItem.TemplateId,
            TemplateName: oItem.TemplateName,
            Department: oItem.Department,
            Category: oItem.Category,
            IsActive: oItem.IsActive,
            SenderEmail: oItem.SenderEmail,
            CreatedBy: oItem.CreatedBy,
            CreatedOn: oItem.CreatedAt,
            LastModifiedOn: oItem.LastModifiedAt,
            Subject: sSubject,
            BodyContent: sFullContent,
            Language: oFirstBody ? oFirstBody.Language : "",
            Version: oFirstBody ? oFirstBody.Version : "",
            __metadata: oItem.__metadata,
          };
        },

        _applyFilters: function () {
          var oEmailModel = this._getEmailModel();
          var aAllTemplates =
            oEmailModel.getProperty("/AllEmailTemplates") || [];
          var sSearchValue = this._normalizeText(
            oEmailModel.getProperty("/SearchValue"),
          );
          var sSelectedCategory = oEmailModel.getProperty("/SelectedCategory");

          var aFilteredTemplates = aAllTemplates.filter(function (oItem) {
            var bMatchSearch =
              !sSearchValue ||
              [
                oItem.TemplateName,
                oItem.TemplateId,
                oItem.Subject,
                oItem.Category,
                oItem.Department,
              ].some(function (vField) {
                return (
                  String(vField || "")
                    .toLowerCase()
                    .indexOf(sSearchValue) > -1
                );
              });

            var bMatchCategory =
              sSelectedCategory === "ALL" ||
              oItem.Category === sSelectedCategory;
            return bMatchSearch && bMatchCategory;
          });

          oEmailModel.setProperty("/EmailTemplates", aFilteredTemplates);
        },

        onSearch: function (oEvent) {
          var sValue = oEvent.getParameter("newValue") || "";
          this._getEmailModel().setProperty("/SearchValue", sValue);
          this._applyFilters();
        },

        onCategoryChange: function (oEvent) {
          var oSelectedItem = oEvent.getParameter("selectedItem");
          var sKey = oSelectedItem ? oSelectedItem.getKey() : "ALL";

          this._getEmailModel().setProperty("/SelectedCategory", sKey);
          this._applyFilters();
        },

        // =========================================================
        // 4. SELECTION / NAVIGATION
        // =========================================================
        _getSelectedTemplate: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          return oContext ? oContext.getObject() : null;
        },

        onItemPress: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          var oTemplate = oContext.getObject();

          if (!this._canUseTemplate(oTemplate)) {
            return;
          }

          this._navToDetail(oContext);
        },

        _navToDetail: function (oContext) {
          var oRouter = this.getOwnerComponent().getRouter();
          var oData = oContext.getObject();

          console.log("NAV DATA:", oData);

          oRouter.navTo("detail", {
            DbKey: encodeURIComponent(oData.DbKey),
            IsActiveEntity: String(oData.IsActiveEntity),
          });
        },

        onCreateEmail: function () {
          this.getOwnerComponent().getRouter().navTo("templatecreate");
        },

        // =========================================================
        // 5. TEMPLATE ACTIONS (EDIT / DELETE / TOGGLE)
        // =========================================================
        _buildHeaderKey: function (oTemplate) {
          var bIsActiveEntity =
            oTemplate.IsActiveEntity === true ||
            oTemplate.IsActiveEntity === "true";

          return this._getODataModel().createKey("/EmailHeader", {
            DbKey: oTemplate.DbKey,
            IsActiveEntity: bIsActiveEntity
          });
        },

        _refreshAfterMutation: function (sMessage) {
          if (sMessage) {
            MessageToast.show(sMessage);
          }
          this._loadTemplates();
        },

        onEditTemplate: function (oEvent) {
          this._openObjectForEdit(oEvent);
        },

        _openObjectForEdit: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          var oTemplate = oContext.getObject();

          if (oTemplate.IsActiveEntity === false) {
            this.getOwnerComponent().getRouter().navTo("templateobject", {
              DbKey: oTemplate.DbKey,
              IsActiveEntity: false,
            });
            return;
          }

          var sETag =
            (oContext.getProperty && oContext.getProperty("__metadata/etag")) ||
            (oTemplate.__metadata && oTemplate.__metadata.etag) ||
            "*";

          this._getODataModel().callFunction("/EmailHeaderEdit", {
            method: "POST",
            headers: {
              "If-Match": sETag,
            },
            urlParameters: {
              DbKey: oTemplate.DbKey,
              IsActiveEntity: true,
              PreserveChanges: true,
            },
            success: function (oResult) {
              this.getOwnerComponent().getRouter().navTo("templateobject", {
                DbKey: oResult.DbKey,
                IsActiveEntity: false,
              });
            }.bind(this),
            error: function (oError) {
              ErrorHandler.show(oError, this._getBundle(), "openDraftFailed");
              /* eslint-disable no-console */
              console.error(oError);
              /* eslint-enable no-console */
            }.bind(this),
          });
        },

        _sanitizePreviewHtml: function (sHtml) {
          return String(sHtml || "")
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
            .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
            .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
            .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
            .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
            .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
            .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
            .replace(/javascript\s*:/gi, "");
        },

        onDeleteTemplate: function (oEvent) {
          var oContext = oEvent.getSource().getBindingContext("email");
          var oData = oContext.getObject();
          var oModel = this._getODataModel();

          MessageBox.confirm(this._getBundle().getText("deleteTemplateConfirm"), {
              onClose: function (sAction) {
                  if (sAction !== MessageBox.Action.OK) {
                      return;
                  }

                  if (oData.IsActiveEntity === false) {
                      oModel.callFunction("/EmailHeaderDiscard", {
                          method: "POST",
                          urlParameters: {
                              DbKey: oData.DbKey,
                              IsActiveEntity: false
                          },
                          success: function () {
                              MessageToast.show(this._getBundle().getText("draftDiscarded"));
                              this._loadTemplates();
                          }.bind(this),
                          error: function (oError) {
                              ErrorHandler.show(oError, this._getBundle(), "discardFailed");
                              console.error(oError);
                          }
                      });
                      return;
                  }

                  var sDeletePath = oModel.createKey("/EmailHeader", {
                    DbKey: oData.DbKey,
                    IsActiveEntity: true
                  });

                  oModel.remove(sDeletePath, {
                    success: function () {
                      MessageToast.show(this._getBundle().getText("deleteSuccess"));
                      this._loadTemplates();
                    }.bind(this),
                    error: function (oError) {
                      ErrorHandler.show(oError, this._getBundle(), "deleteFailed");
                      console.error(oError);
                    }.bind(this)
                  });
              }.bind(this)
          });
      },

        onToggleActive: function (oEvent) {
          var bState = oEvent.getParameter("state");
          var oTemplate = this._getSelectedTemplate(oEvent);
          var oModel = this._getODataModel();

          if (!oTemplate) {
            MessageBox.error(this._getBundle().getText("templateNotFoundForStatusUpdate"));
            return;
          }

          this._setBusy(true);

          var fnUpdateDraftAndActivate = function (oDraft) {
            var sDraftPath = oModel.createKey("/EmailHeader", {
              DbKey: oDraft.DbKey,
              IsActiveEntity: false
            });

            oModel.update(
              sDraftPath,
              {
                IsActive: bState
              },
              {
                headers: {
                  "If-Match": (oDraft.__metadata && oDraft.__metadata.etag) || "*"
                },
                success: function () {
                  oModel.callFunction("/EmailHeaderActivate", {
                    method: "POST",
                    urlParameters: {
                      DbKey: oDraft.DbKey,
                      IsActiveEntity: false
                    },
                    success: function () {
                      this._setBusy(false);
                      this._refreshAfterMutation(
                        this._getBundle().getText("templateStatusChanged", [
                          oTemplate.TemplateId,
                          bState ? this._getBundle().getText("active") : this._getBundle().getText("inactive")
                        ])
                      );
                    }.bind(this),
                    error: function (oError) {
                      this._setBusy(false);
                      ErrorHandler.show(oError, this._getBundle(), "activateFailed");
                      this._loadTemplates();
                    }.bind(this)
                  });
                }.bind(this),
                error: function (oError) {
                  this._setBusy(false);
                  ErrorHandler.show(oError, this._getBundle(), "updateDraftFailed");
                  this._loadTemplates();
                }.bind(this)
              }
            );
          }.bind(this);

          if (oTemplate.IsActiveEntity === false) {
            fnUpdateDraftAndActivate(oTemplate);
            return;
          }

          var sETag =
            (oTemplate.__metadata && oTemplate.__metadata.etag) || "*";

          oModel.callFunction("/EmailHeaderEdit", {
            method: "POST",
            headers: {
              "If-Match": sETag
            },
            urlParameters: {
              DbKey: oTemplate.DbKey,
              IsActiveEntity: true,
              PreserveChanges: true
            },
            success: function (oDraft) {
              fnUpdateDraftAndActivate(oDraft);
            }.bind(this),
            error: function (oError) {
              this._setBusy(false);
              ErrorHandler.show(oError, this._getBundle(), "createDraftFailed");
              this._loadTemplates();
            }.bind(this)
          });
        },

        // =========================================================
        // 6. PREVIEW
        // =========================================================
        onPreviewTemplate: function (oEvent) {
          var oTemplate = this._getSelectedTemplate(oEvent);

          if (!oTemplate) {
            MessageBox.error(this._getBundle().getText("templateNotFound"));
            return;
          }

          if (!this._oPreviewDialog) {
            this._oPreviewDialog = new Dialog({
              title: this._getBundle().getText("previewTemplateTitle"),
              contentWidth: "800px",
              contentHeight: "500px",
              resizable: true,
              draggable: true,
              endButton: new Button({
                text: this._getBundle().getText("close"),
                press: function () {
                  this._oPreviewDialog.close();
                }.bind(this),
              }),
            });

            this.getView().addDependent(this._oPreviewDialog);
          }

          var sHtml = oTemplate.BodyContent || "<div>" + this._getBundle().getText("noContent") + "</div>";

          sHtml = this._sanitizePreviewHtml(sHtml);

          sHtml = sHtml
            .replace(/{{/g, "&#123;&#123;")
            .replace(/}}/g, "&#125;&#125;");

          this._oPreviewDialog.removeAllContent();
          this._oPreviewDialog.addContent(
            new HTML({
              content:
                "<div style='padding:16px;background:#fff;min-height:400px;overflow:auto;'>" +
                sHtml +
                "</div>",
              preferDOM: true,
            }),
          );

          this._oPreviewDialog.open();
        },

        // =========================================================
        // 8. UTILITIES
        // =========================================================
        _extractSubject: function (sContent) {
          if (!sContent) {
            return "";
          }

          var sText = String(sContent || "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ");

          var aLines = sText
            .split("\n")
            .map(function (sLine) {
              return String(sLine || "").trim();
            })
            .filter(Boolean);

          var sSubjectLine = aLines.find(function (sLine) {
            return /^subject\s*[:=]\s*/i.test(sLine);
          });

          if (sSubjectLine) {
            return sSubjectLine
              .replace(/^subject\s*[:=]\s*/i, "")
              .replace(/^["']|["']$/g, "")
              .trim();
          }

          return "";
        },

        _removeSubjectLine: function (sContent) {
          return String(sContent || "")
            .replace(/<p>\s*subject\s*[:=][\s\S]*?<br\s*\/?>/i, "<p>")
            .replace(/^subject\s*[:=].*$/gim, "")
            .trim();
        },

        _normalizeText: function (vValue) {
          return String(vValue || "")
            .toLowerCase()
            .trim();
        },

        _canUseTemplate: function (oTemplate) {
          if (!oTemplate) {
            MessageBox.error(this._getBundle().getText("templateNotFound"));
            return false;
          }

          if (oTemplate.IsActiveEntity === false) {
            MessageBox.warning(this._getBundle().getText("draftTemplateCannotBeUsed"));
            return false;
          }

          if (oTemplate.IsActive !== true) {
            MessageBox.warning(this._getBundle().getText("inactiveTemplateCannotBeUsed"));
            return false;
          }

          return true;
        },

      },
    );
  },
);
