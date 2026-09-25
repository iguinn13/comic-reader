; Desinstalador: pergunta se os dados do usuário (biblioteca, capas, banco) também devem ser removidos.
; O padrão é manter, para que reinstalar não apague a biblioteca (docs/08 §M8.1).
!macro customUnInstall
  ${ifNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Deseja remover também a sua biblioteca e os dados do Comic Reader?$\r$\n$\r$\nEsta ação apaga as HQs importadas, o progresso de leitura e as coleções, e não pode ser desfeita." IDNO keepUserData
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
    keepUserData:
  ${endIf}
!macroend
