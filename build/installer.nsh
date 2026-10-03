!macro customUnInstall
  ${ifNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Deseja remover também a sua biblioteca e os dados do Comic Reader?$\r$\n$\r$\nEsta ação apaga as HQs importadas, o progresso de leitura e as coleções, e não pode ser desfeita." IDNO keepUserData
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
    keepUserData:
  ${endIf}
!macroend
